import { centsToDecimalString, formatCents, formatMoney, parseDecimalToCents } from './money';

describe('money', () => {
  describe('parseDecimalToCents', () => {
    it('parses the backend two-decimal string format into integer cents', () => {
      expect(parseDecimalToCents('12.99')).toBe(1299);
      expect(parseDecimalToCents('4.25')).toBe(425);
      expect(parseDecimalToCents('0.05')).toBe(5);
      expect(parseDecimalToCents('0.00')).toBe(0);
    });

    it('accepts whole and single-decimal values without float math', () => {
      expect(parseDecimalToCents('12')).toBe(1200);
      expect(parseDecimalToCents('12.9')).toBe(1290);
    });

    it('supports negative deltas', () => {
      expect(parseDecimalToCents('-2.50')).toBe(-250);
    });

    it('ignores surrounding whitespace', () => {
      expect(parseDecimalToCents(' 3.50 ')).toBe(350);
    });

    it('rejects malformed values or more precision than the wire format allows', () => {
      expect(parseDecimalToCents('')).toBeNull();
      expect(parseDecimalToCents('abc')).toBeNull();
      expect(parseDecimalToCents('1.234')).toBeNull();
      expect(parseDecimalToCents('1,20')).toBeNull();
    });
  });

  describe('formatCents', () => {
    it('formats integer cents as USD', () => {
      expect(formatCents(1299)).toBe('$12.99');
      expect(formatCents(5)).toBe('$0.05');
      expect(formatCents(0)).toBe('$0.00');
    });

    it('formats negative amounts with the sign before the currency symbol', () => {
      expect(formatCents(-250)).toBe('-$2.50');
    });
  });

  describe('centsToDecimalString', () => {
    it('renders integer cents back into the backend two-decimal wire format', () => {
      expect(centsToDecimalString(1299)).toBe('12.99');
      expect(centsToDecimalString(129)).toBe('1.29');
      expect(centsToDecimalString(5)).toBe('0.05');
      expect(centsToDecimalString(0)).toBe('0.00');
      expect(centsToDecimalString(-250)).toBe('-2.50');
    });
  });

  describe('formatMoney', () => {
    it('parses and formats Decimal strings', () => {
      expect(formatMoney('4.25')).toBe('$4.25');
    });

    it('falls back to the raw value when the string is not parseable', () => {
      expect(formatMoney('n/a')).toBe('n/a');
    });
  });
});
