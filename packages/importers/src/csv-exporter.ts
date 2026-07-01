/**
 * CSV exporter for ParsedTransaction arrays.
 * Produces output compatible with round-trip re-parsing using the default CSV mapping.
 */

import { ParsedTransaction } from './types';

const HEADER = 'date,amount,type,description,category';

/**
 * Escapes a CSV field value, wrapping in quotes if it contains commas, quotes, or newlines.
 * @param value - The field value to escape.
 * @returns The escaped field value.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Exports an array of ParsedTransaction to a CSV Buffer.
 * Columns: date, amount, type, description, category.
 *
 * The amount column includes the sign (negative for DEBIT) so round-trip
 * parsing with default mapping produces equivalent data.
 *
 * @param transactions - Array of transactions to export.
 * @returns Buffer containing the CSV content.
 */
export function exportCsv(transactions: ParsedTransaction[]): Buffer {
  const lines: string[] = [HEADER];

  for (const tx of transactions) {
    const signedAmount = tx.type === 'DEBIT' ? `-${tx.amount}` : tx.amount;
    const desc = tx.description ? escapeCsvField(tx.description) : '';
    const cat = tx.category ? escapeCsvField(tx.category) : '';

    lines.push(`${tx.date},${signedAmount},${tx.type},${desc},${cat}`);
  }

  return Buffer.from(lines.join('\n') + '\n', 'utf-8');
}
