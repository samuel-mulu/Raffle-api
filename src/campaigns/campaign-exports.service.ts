import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { CampaignsService } from './campaigns.service';

type ExportTicketRow = {
  ticketId: string;
  ticketNumber: number;
  ticketStatus: string;
  reservedUntil: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  paymentStatus: string | null;
  amount: number | null;
  transactionId: string | null;
  approvedAt: Date | null;
  buyerId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  proofUrl: string | null;
  prizeRank: number | null;
};

type ExportPayload = {
  campaign: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    ticketPrice: number;
    totalTickets: number;
    drawAt: Date | null;
    createdAt: Date;
    creator: {
      id: string;
      name: string | null;
      phone: string | null;
    } | null;
  };
  summary: {
    campaignId: string;
    title: string;
    status: string;
    totalTickets: number;
    sold: number;
    taken: number;
    remaining: number;
    counts: Record<string, number>;
    paymentCounts: Record<string, number>;
    expiredReservations: number;
  };
  rows: ExportTicketRow[];
  winners: Array<{
    prizeRank: number;
    ticketNumber: number;
    buyerName: string | null;
    buyerPhone: string | null;
  }>;
};

@Injectable()
export class CampaignExportsService {
  constructor(private readonly campaigns: CampaignsService) {}

  async exportCreatorCampaignXlsx(creatorId: string, campaignId: string) {
    const data = await this.campaigns.getExportDataForCreator(
      creatorId,
      campaignId,
    );
    return this.buildFileResult(data, 'xlsx');
  }

  async exportCreatorCampaignPdf(creatorId: string, campaignId: string) {
    const data = await this.campaigns.getExportDataForCreator(
      creatorId,
      campaignId,
    );
    return this.buildFileResult(data, 'pdf');
  }

  async exportAdminCampaignXlsx(campaignId: string) {
    const data = await this.campaigns.getExportDataForAdmin(campaignId);
    return this.buildFileResult(data, 'xlsx');
  }

  async exportAdminCampaignPdf(campaignId: string) {
    const data = await this.campaigns.getExportDataForAdmin(campaignId);
    return this.buildFileResult(data, 'pdf');
  }

  private async buildFileResult(
    data: ExportPayload,
    extension: 'pdf' | 'xlsx',
  ) {
    const buffer =
      extension === 'xlsx'
        ? await this.buildXlsxBuffer(data)
        : await this.buildPdfBuffer(data);

    return {
      fileName: this.buildFileName(data.campaign.title, extension),
      buffer,
      contentType:
        extension === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
    };
  }

  private async buildXlsxBuffer(data: ExportPayload) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'raffle-api';
    workbook.created = new Date();

    this.addSummarySheet(workbook, data);
    this.addTicketsSheet(workbook, data);
    this.addBuyersSheet(workbook, data);
    this.addPaymentsSheet(workbook, data);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, data: ExportPayload) {
    const sheet = workbook.addWorksheet('Summary');
    sheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 42 },
    ];

    sheet.addRows([
      { field: 'Campaign ID', value: data.campaign.id },
      { field: 'Title', value: data.campaign.title },
      { field: 'Status', value: data.campaign.status },
      { field: 'Creator', value: data.campaign.creator?.name ?? 'Unassigned' },
      { field: 'Creator Phone', value: data.campaign.creator?.phone ?? '-' },
      { field: 'Ticket Price', value: data.campaign.ticketPrice },
      { field: 'Total Tickets', value: data.summary.totalTickets },
      { field: 'Sold', value: data.summary.sold },
      { field: 'Taken', value: data.summary.taken },
      { field: 'Remaining', value: data.summary.remaining },
      {
        field: 'Expired Reservations',
        value: data.summary.expiredReservations,
      },
      { field: 'Draw At', value: this.formatDate(data.campaign.drawAt) },
      { field: 'Created At', value: this.formatDate(data.campaign.createdAt) },
    ]);

    sheet.addRow({});
    sheet.addRow({ field: 'Ticket Status Breakdown', value: '' });
    Object.entries(data.summary.counts).forEach(([status, count]) => {
      sheet.addRow({ field: status, value: count });
    });

    sheet.addRow({});
    sheet.addRow({ field: 'Payment Breakdown', value: '' });
    Object.entries(data.summary.paymentCounts).forEach(([status, count]) => {
      sheet.addRow({ field: status, value: count });
    });

    sheet.getRow(1).font = { bold: true };
  }

  private addTicketsSheet(workbook: ExcelJS.Workbook, data: ExportPayload) {
    const sheet = workbook.addWorksheet('Tickets');
    sheet.columns = [
      { header: 'Ticket Number', key: 'ticketNumber', width: 14 },
      { header: 'Ticket Status', key: 'ticketStatus', width: 18 },
      { header: 'Buyer Name', key: 'buyerName', width: 24 },
      { header: 'Buyer Phone', key: 'buyerPhone', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Transaction ID', key: 'transactionId', width: 18 },
      { header: 'Reserved Until', key: 'reservedUntil', width: 22 },
      { header: 'Paid At', key: 'paidAt', width: 22 },
      { header: 'Prize Rank', key: 'prizeRank', width: 12 },
    ];

    data.rows.forEach((row) => {
      sheet.addRow({
        ticketNumber: row.ticketNumber,
        ticketStatus: row.ticketStatus,
        buyerName: row.buyerName ?? '-',
        buyerPhone: row.buyerPhone ?? '-',
        paymentStatus: row.paymentStatus ?? '-',
        amount: row.amount ?? '-',
        transactionId: row.transactionId ?? '-',
        reservedUntil: this.formatDate(row.reservedUntil),
        paidAt: this.formatDate(row.paidAt),
        prizeRank: row.prizeRank ?? '-',
      });
    });

    sheet.getRow(1).font = { bold: true };
  }

  private addBuyersSheet(workbook: ExcelJS.Workbook, data: ExportPayload) {
    const sheet = workbook.addWorksheet('Buyers');
    sheet.columns = [
      { header: 'Buyer ID', key: 'buyerId', width: 28 },
      { header: 'Buyer Name', key: 'buyerName', width: 24 },
      { header: 'Buyer Phone', key: 'buyerPhone', width: 18 },
      { header: 'Ticket Number', key: 'ticketNumber', width: 14 },
      { header: 'Ticket Status', key: 'ticketStatus', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Amount', key: 'amount', width: 12 },
    ];

    data.rows
      .filter((row) => row.buyerId)
      .forEach((row) => {
        sheet.addRow({
          buyerId: row.buyerId,
          buyerName: row.buyerName ?? '-',
          buyerPhone: row.buyerPhone ?? '-',
          ticketNumber: row.ticketNumber,
          ticketStatus: row.ticketStatus,
          paymentStatus: row.paymentStatus ?? '-',
          amount: row.amount ?? '-',
        });
      });

    sheet.getRow(1).font = { bold: true };
  }

  private addPaymentsSheet(workbook: ExcelJS.Workbook, data: ExportPayload) {
    const sheet = workbook.addWorksheet('Payments');
    sheet.columns = [
      { header: 'Ticket Number', key: 'ticketNumber', width: 14 },
      { header: 'Buyer Name', key: 'buyerName', width: 24 },
      { header: 'Buyer Phone', key: 'buyerPhone', width: 18 },
      { header: 'Payment Status', key: 'paymentStatus', width: 18 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Transaction ID', key: 'transactionId', width: 18 },
      { header: 'Approved At', key: 'approvedAt', width: 22 },
      { header: 'Proof URL', key: 'proofUrl', width: 36 },
    ];

    data.rows
      .filter((row) => row.paymentStatus)
      .forEach((row) => {
        sheet.addRow({
          ticketNumber: row.ticketNumber,
          buyerName: row.buyerName ?? '-',
          buyerPhone: row.buyerPhone ?? '-',
          paymentStatus: row.paymentStatus ?? '-',
          amount: row.amount ?? '-',
          transactionId: row.transactionId ?? '-',
          approvedAt: this.formatDate(row.approvedAt),
          proofUrl: row.proofUrl ?? '-',
        });
      });

    sheet.getRow(1).font = { bold: true };
  }

  private buildPdfBuffer(data: ExportPayload) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.writePdf(doc, data);
      doc.end();
    });
  }

  private writePdf(doc: PDFKit.PDFDocument, data: ExportPayload) {
    let y = 40;

    const writeLine = (label: string, value: string) => {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }

      doc.font('Helvetica-Bold').fontSize(10).text(`${label}:`, 40, y);
      doc.font('Helvetica').fontSize(10).text(value, 180, y, {
        width: 360,
      });
      y += 18;
    };

    doc.font('Helvetica-Bold').fontSize(18).text(data.campaign.title, 40, y);
    y += 28;

    writeLine('Campaign ID', data.campaign.id);
    writeLine('Status', data.campaign.status);
    writeLine('Creator', data.campaign.creator?.name ?? 'Unassigned');
    writeLine('Creator Phone', data.campaign.creator?.phone ?? '-');
    writeLine('Ticket Price', String(data.campaign.ticketPrice));
    writeLine('Total Tickets', String(data.summary.totalTickets));
    writeLine('Sold', String(data.summary.sold));
    writeLine('Taken', String(data.summary.taken));
    writeLine('Remaining', String(data.summary.remaining));
    writeLine('Expired Reservations', String(data.summary.expiredReservations));
    writeLine('Draw At', this.formatDate(data.campaign.drawAt));
    writeLine('Created At', this.formatDate(data.campaign.createdAt));

    y += 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Ticket Status Breakdown', 40, y);
    y += 20;
    Object.entries(data.summary.counts).forEach(([status, count]) => {
      writeLine(status, String(count));
    });

    y += 12;
    doc.font('Helvetica-Bold').fontSize(13).text('Payment Breakdown', 40, y);
    y += 20;
    Object.entries(data.summary.paymentCounts).forEach(([status, count]) => {
      writeLine(status, String(count));
    });

    y += 12;
    doc.font('Helvetica-Bold').fontSize(13).text('Winners', 40, y);
    y += 20;

    if (data.winners.length === 0) {
      writeLine('Winners', 'No winners recorded yet');
    } else {
      data.winners.forEach((winner) => {
        writeLine(
          `Rank ${winner.prizeRank}`,
          `Ticket ${winner.ticketNumber} - ${winner.buyerName ?? 'Unknown'} (${winner.buyerPhone ?? '-'})`,
        );
      });
    }

    y += 12;
    doc.font('Helvetica-Bold').fontSize(13).text('Buyer Summary Rows', 40, y);
    y += 20;

    data.rows
      .filter((row) => row.buyerId)
      .forEach((row) => {
        writeLine(
          `Ticket ${row.ticketNumber}`,
          `${row.buyerName ?? 'Unknown'} | ${row.buyerPhone ?? '-'} | ${row.ticketStatus} | ${row.paymentStatus ?? 'NO_PAYMENT'}`,
        );
      });
  }

  private buildFileName(title: string, extension: 'pdf' | 'xlsx') {
    const safe = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return `${safe || 'campaign-report'}.${extension}`;
  }

  private formatDate(value: Date | null) {
    return value ? value.toISOString() : '-';
  }
}
