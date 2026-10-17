/**
 * Kenyan Shilling (KES) Money Math & Formatting Utilities
 *
 * Rules:
 * - All monetary amounts are stored as integer KES cents (BigInt), NEVER floating point numbers.
 *   E.g., KES 150.50 is represented as 15050n cents.
 * - Displayed using Intl.NumberFormat('en-KE') at the UI boundary.
 */

const KES_FORMATTER = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const KES_COMPACT_FORMATTER = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Format integer cents into Kenyan Shilling string (e.g. 1500000n -> "KES 15,000.00")
 */
export function formatKes(cents: bigint | number | string): string {
  const centsBigInt = BigInt(cents);
  const shillings = Number(centsBigInt) / 100;
  return KES_FORMATTER.format(shillings);
}

/**
 * Format integer cents into compact KES string (e.g. 150000000n -> "KES 1.5M")
 */
export function formatKesCompact(cents: bigint | number | string): string {
  const centsBigInt = BigInt(cents);
  const shillings = Number(centsBigInt) / 100;
  return KES_COMPACT_FORMATTER.format(shillings);
}

/**
 * Parse a human input string (e.g. "1,500.50" or "1500.50") safely to integer BigInt cents
 * Avoids IEEE-754 binary floating point precision loss.
 */
export function parseKesToCents(amountStr: string | number): bigint {
  if (typeof amountStr === 'number') {
    if (!Number.isFinite(amountStr)) {
      throw new Error(`Invalid non-finite number: ${amountStr}`);
    }
    return BigInt(Math.round(amountStr * 100));
  }

  const clean = amountStr.trim().replace(/,/g, '').replace(/^KES\s*/i, '');
  if (!clean || clean === '') {
    return 0n;
  }

  const parts = clean.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid monetary format: ${amountStr}`);
  }

  const wholeStr = parts[0] || '0';
  let fracStr = parts[1] || '00';

  if (fracStr.length === 1) {
    fracStr = fracStr + '0';
  } else if (fracStr.length > 2) {
    fracStr = fracStr.slice(0, 2);
  }

  const sign = wholeStr.startsWith('-') ? -1n : 1n;
  const absWholeStr = wholeStr.replace(/^-/, '');

  const wholeBigInt = BigInt(absWholeStr);
  const fracBigInt = BigInt(fracStr);

  return sign * (wholeBigInt * 100n + fracBigInt);
}

/**
 * Format a Kenyan phone number into masked form for privacy:
 * Example: "254712345678" -> "2547****5678"
 */
export function maskMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, '');
  if (digits.length < 8) return '****';
  const prefix = digits.slice(0, 4);
  const suffix = digits.slice(-3);
  return `${prefix}****${suffix}`;
}
