/**
 * Decimal.js utility types and helpers for currency precision.
 */
import { Decimal } from 'decimal.js';

/** Re-export Decimal class for consumers. */
export { Decimal };

/** Type alias for serialized decimal values (used in DTOs and API transport). */
export type SerializedDecimal = string;

/**
 * Converts a serialized decimal string to a Decimal instance.
 * @param value - The string representation of a decimal number.
 * @returns A Decimal.js instance.
 */
export function toDecimal(value: SerializedDecimal): Decimal {
  return new Decimal(value);
}

/**
 * Converts a Decimal instance to its serialized string representation.
 * @param value - A Decimal.js instance.
 * @returns The string representation.
 */
export function fromDecimal(value: Decimal): SerializedDecimal {
  return value.toString();
}

/**
 * Checks if a string is a valid decimal number.
 * @param value - The string to validate.
 * @returns True if the string can be parsed as a Decimal.
 */
export function isValidDecimal(value: string): boolean {
  try {
    new Decimal(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a decimal value for display with a fixed number of decimal places.
 * @param value - The Decimal or serialized decimal string.
 * @param places - Number of decimal places (default: 2).
 * @returns Formatted string with fixed decimal places.
 */
export function formatCurrency(value: Decimal | SerializedDecimal, places = 2): string {
  const decimal = value instanceof Decimal ? value : new Decimal(value);
  return decimal.toFixed(places);
}
