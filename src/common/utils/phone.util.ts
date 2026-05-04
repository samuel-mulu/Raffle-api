import { BadRequestException } from '@nestjs/common';

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();

  if (!trimmed) {
    throw new BadRequestException('Phone number is required');
  }

  const normalized = trimmed.replace(/[\s\-().]/g, '').replace(/^00/, '+');

  const withCountryCode = normalized.startsWith('+')
    ? normalized
    : `+${normalized}`;

  if (!E164_REGEX.test(withCountryCode)) {
    throw new BadRequestException(
      'Phone number must be in international E.164 format',
    );
  }

  return withCountryCode;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 8) {
    return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  }

  return phone.replace(/(\+\d{3})\d+(\d{3})$/, '$1****$2');
}
