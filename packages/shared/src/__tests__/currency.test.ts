import { describe, it, expect } from 'vitest';
import { formatKes, formatKesCompact, parseKesToCents, maskMsisdn } from '../currency';

describe('Kenyan Currency & MSISDN Utilities', () => {
  it('formats KES amounts correctly with 2 decimal places', () => {
    expect(formatKes(100000n)).toMatch(/(?:KES|Ksh)\s*1,000\.00/);
    expect(formatKes(5050n)).toMatch(/(?:KES|Ksh)\s*50\.50/);
    expect(formatKes(0n)).toMatch(/(?:KES|Ksh)\s*0\.00/);
  });

  it('formats compact KES amounts', () => {
    const formatted = formatKesCompact(150000000n);
    expect(formatted).toMatch(/1\.5M/);
  });

  it('parses string inputs safely to integer BigInt cents avoiding float errors', () => {
    expect(parseKesToCents('100.00')).toBe(10000n);
    expect(parseKesToCents('1,500.50')).toBe(150050n);
    expect(parseKesToCents('KES 2,450')).toBe(245000n);
    expect(parseKesToCents(180.5)).toBe(18050n);
  });

  it('masks Kenyan phone numbers for privacy', () => {
    expect(maskMsisdn('254712345678')).toBe('2547****678');
    expect(maskMsisdn('+254 722 987 654')).toBe('2547****654');
  });
});
