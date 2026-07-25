import { Prisma } from '@prisma/client';

/**
 * Money handling for CricSquad.
 *
 * Rule: every amount that crosses the DB boundary is a Prisma.Decimal with two
 * decimal places (SGD). Every piece of arithmetic — summing, allocating,
 * comparing — happens on integer cents. Floats are never used for money.
 */

export type Cents = number;

/** Parse anything the DB or an HTTP body can hand us into integer cents. */
export function toCents(value: Prisma.Decimal | string | number | null | undefined): Cents {
  if (value === null || value === undefined) return 0;

  // Decimal.js keeps exact decimal arithmetic, so scaling by 100 here is safe
  // in a way that `value * 100` on a JS number is not.
  const dec = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  const scaled = dec.times(100);

  if (!scaled.isInteger()) {
    // Sub-cent precision cannot be represented; round half-up to the cent.
    return Number(scaled.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toString());
  }
  return Number(scaled.toString());
}

/** Convert integer cents back to the Decimal(12,2) the schema stores. */
export function toDecimal(cents: Cents): Prisma.Decimal {
  if (!Number.isInteger(cents)) {
    throw new Error(`toDecimal expects integer cents, received ${cents}`);
  }
  return new Prisma.Decimal(cents).dividedBy(100).toDecimalPlaces(2);
}

/** "1234.50" style string for API responses — never a float. */
export function centsToString(cents: Cents): string {
  return toDecimal(cents).toFixed(2);
}

/** Display form used in summaries and confirmation screens. */
export function formatSGD(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-SG');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}S$${whole}.${frac}`;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}

/**
 * Validate a user-supplied money string/number and return cents.
 * Throws a plain Error the route layer turns into an inline field message.
 */
export function parseMoneyInput(input: unknown, fieldName = 'amount'): Cents {
  if (input === null || input === undefined || input === '') {
    throw new Error(`${fieldName} is required`);
  }
  const asString = typeof input === 'number' ? input.toString() : String(input).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(asString)) {
    throw new Error(`${fieldName} must be a number with at most 2 decimal places`);
  }
  const cents = toCents(asString);
  if (cents <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }
  return cents;
}
