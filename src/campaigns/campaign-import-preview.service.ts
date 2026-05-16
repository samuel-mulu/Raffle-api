import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';

const MAX_PREVIEW_ROWS = 2000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportPreviewRow = {
  buyerName: string | null;
  buyerPhone: string | null;
  ticketNumber: string | null;
  ticketStatus: string | null;
  paymentStatus: string | null;
};

export type ImportPreviewResult = {
  source: 'csv' | 'xlsx';
  columns: string[];
  rows: ImportPreviewRow[];
  truncated: boolean;
};

function cellToPlainString(cell: ExcelJS.Cell): string {
  const v = cell?.value;

  if (v == null) {
    return '';
  }

  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }

  if (typeof v === 'string') {
    return v.trim();
  }

  if (typeof v === 'object') {
    if ('text' in v && typeof (v as { text?: string }).text === 'string') {
      return (v as { text: string }).text.trim();
    }
    if ('result' in v && (v as { result?: unknown }).result != null) {
      return String((v as { result: unknown }).result).trim();
    }
    if (
      'richText' in v &&
      Array.isArray((v as { richText: { text?: string }[] }).richText)
    ) {
      return (v as { richText: { text?: string }[] }).richText
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
  }

  return String(v).trim();
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }

  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveColumnIndexes(headers: string[]) {
  const n = headers.map((h) => normalizeHeader(h));

  const findBy = (predicate: (h: string) => boolean) =>
    n.findIndex((h) => h.length > 0 && predicate(h));

  const buyerNameIdx = findBy((h) => {
    if (h.includes('creator')) return false;
    return h === 'buyer name' || (h.includes('buyer') && h.includes('name'));
  });

  let nameIdx =
    buyerNameIdx >= 0
      ? buyerNameIdx
      : findBy((h) => h === 'name' && !h.includes('buyer'));

  if (
    findBy((h) => h === 'name') >= 0 &&
    !n.some((h) => h.includes('buyer') && h.includes('name'))
  ) {
    nameIdx = findBy((h) => h === 'name');
  }

  const buyerPhoneIdx = findBy((h) => {
    if (h.includes('creator')) return false;
    return (
      h === 'buyer phone' ||
      (h.includes('buyer') && h.includes('phone')) ||
      h === 'phone number' ||
      h === 'mobile' ||
      h === 'msisdn'
    );
  });

  let phoneIdx =
    buyerPhoneIdx >= 0
      ? buyerPhoneIdx
      : findBy(
          (h) =>
            (h === 'phone' || h.endsWith(' phone')) &&
            !h.includes('creator'),
        );

  const ticketIdx = findBy(
    (h) =>
      (h.includes('ticket') && h.includes('number')) || h === 'ticket #',
  );

  const ticketStatusIdx = findBy(
    (h) => h.includes('ticket') && h.includes('status'),
  );

  const paymentStatusIdx = findBy(
    (h) =>
      (h.includes('payment') && h.includes('status')) ||
      h === 'paymentstatus',
  );

  return {
    nameIdx,
    phoneIdx,
    ticketIdx,
    ticketStatusIdx,
    paymentStatusIdx,
  };
}

function buildRows(
  headers: string[],
  dataRows: string[][],
): { rows: ImportPreviewRow[]; truncated: boolean } {
  const {
    nameIdx,
    phoneIdx,
    ticketIdx,
    ticketStatusIdx,
    paymentStatusIdx,
  } = resolveColumnIndexes(headers);

  if (nameIdx < 0 && phoneIdx < 0) {
    throw new BadRequestException(
      'Could not find Buyer Name / Name or Buyer Phone columns. Use the exported Buyers sheet or the CSV template.',
    );
  }

  const rows: ImportPreviewRow[] = [];
  let truncated = false;

  for (const cells of dataRows) {
    if (cells.every((c) => !String(c ?? '').trim())) {
      continue;
    }

    if (rows.length >= MAX_PREVIEW_ROWS) {
      truncated = true;
      break;
    }

    const name =
      nameIdx >= 0 &&
      cells[nameIdx] != null &&
      String(cells[nameIdx]).trim().length > 0
        ? String(cells[nameIdx]).trim()
        : null;
    const phone =
      phoneIdx >= 0 &&
      cells[phoneIdx] != null &&
      String(cells[phoneIdx]).trim().length > 0
        ? String(cells[phoneIdx]).trim()
        : null;

    rows.push({
      buyerName: name,
      buyerPhone: phone,
      ticketNumber:
        ticketIdx >= 0 &&
        cells[ticketIdx] != null &&
        String(cells[ticketIdx]).trim().length > 0
          ? String(cells[ticketIdx]).trim()
          : null,
      ticketStatus:
        ticketStatusIdx >= 0 &&
        cells[ticketStatusIdx] != null &&
        String(cells[ticketStatusIdx]).trim().length > 0
          ? String(cells[ticketStatusIdx]).trim()
          : null,
      paymentStatus:
        paymentStatusIdx >= 0 &&
        cells[paymentStatusIdx] != null &&
        String(cells[paymentStatusIdx]).trim().length > 0
          ? String(cells[paymentStatusIdx]).trim()
          : null,
    });
  }

  return { rows, truncated };
}

@Injectable()
export class CampaignImportPreviewService {
  async parseForPreview(
    buffer: Buffer,
    originalname: string,
  ): Promise<ImportPreviewResult> {
    if (!buffer?.length) {
      throw new BadRequestException('Empty file');
    }

    if (buffer.length > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('File must be smaller than 2 MB');
    }

    const lower = originalname.toLowerCase();
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      return this.parseCsv(buffer);
    }

    if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
      return this.parseXlsx(buffer);
    }

    throw new BadRequestException(
      'Unsupported format. Upload a CSV file or an Excel workbook (.xlsx).',
    );
  }

  private parseCsv(buffer: Buffer): ImportPreviewResult {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (!lines.length) {
      throw new BadRequestException('CSV has no rows');
    }

    const headerCells = parseCsvLine(lines[0]);
    const dataLines = lines.slice(1);
    const dataRows = dataLines.map(parseCsvLine);

    const { rows, truncated } = buildRows(headerCells, dataRows);

    return {
      source: 'csv',
      columns: headerCells,
      rows,
      truncated,
    };
  }

  private async parseXlsx(buffer: Buffer): Promise<ImportPreviewResult> {
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error exceljs load() declares a narrower Buffer type than `@types/node` provides
    await workbook.xlsx.load(buffer);

    const byName =
      workbook.getWorksheet('Buyers') ??
      workbook.getWorksheet('buyers') ??
      workbook.worksheets.find(
        (w) => normalizeHeader(w.name) === 'buyers',
      );

    const sheet = byName ?? workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException('Workbook has no worksheets');
    }

    const headers: string[] = [];
    const dataRows: string[][] = [];

    const rowCount = sheet.rowCount;
    const readCap = MAX_PREVIEW_ROWS + 2000;
    let stoppedEarly = false;

    for (let r = 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);

      const values: string[] = [];
      const lastCol = row.cellCount;

      for (let c = 1; c <= lastCol; c++) {
        values.push(cellToPlainString(row.getCell(c)));
      }

      while (values.length && values[values.length - 1] === '') {
        values.pop();
      }

      if (r === 1) {
        headers.splice(0, headers.length, ...values);
        continue;
      }

      if (values.every((v) => !v.trim())) {
        continue;
      }

      if (dataRows.length < readCap) {
        dataRows.push(values);
      } else {
        stoppedEarly = true;
        break;
      }
    }

    const { rows, truncated: capTrunc } = buildRows(headers, dataRows);

    return {
      source: 'xlsx',
      columns: headers,
      rows,
      truncated: capTrunc || stoppedEarly,
    };
  }
}
