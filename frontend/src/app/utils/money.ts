/**
 * Money helpers for the backend's `Decimal` wire format.
 *
 * The backend formats money as a string with two decimal places (for example
 * `"12.99"`). The frontend parses those strings into integer cents so display
 * and any aggregation never introduce floating-point error; authoritative
 * totals are always computed server-side.
 */

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

/**
 * Parses a backend Decimal money string into integer cents.
 *
 * Returns `null` when the value is malformed or carries more precision than
 * the two-decimal wire format, so callers can fall back to the raw value
 * instead of silently rounding money.
 */
export function parseDecimalToCents(value: string): number | null {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > 2) {
    return null;
  }

  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

/** Formats integer cents as a USD amount (the seeded shop currency). */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}

/**
 * Renders integer cents back into the backend's two-decimal Decimal wire
 * format (no currency symbol), for money inputs such as payment amounts.
 */
export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}

/** Formats a backend Decimal money string, falling back to the raw value. */
export function formatMoney(value: string): string {
  const cents = parseDecimalToCents(value);
  return cents === null ? value : formatCents(cents);
}
