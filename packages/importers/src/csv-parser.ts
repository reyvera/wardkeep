/**
 * CSV parser with configurable column mapping.
 */

import { ColumnMapping, ParsedTransaction, ParseError, ParseResult } from './types';

const MAX_ROWS = 50_000;

/**
 * Attempts to parse a date string in common formats.
 * Supported: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, M/D/YYYY variants.
 * @param raw - The raw date string to parse.
 * @returns ISO date string (YYYY-MM-DD) or null if unparseable.
 */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    const month = parseInt(part1, 10);
    const day = parseInt(part2, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Parses an amount string, removing currency symbols and commas.
 * @param raw - The raw amount string.
 * @returns An object with the absolute amount string and whether it's negative.
 */
function parseAmount(raw: string): { amount: string; negative: boolean } | null {
  let trimmed = raw.trim();

  // Handle parentheses notation for negatives: (123.45)
  const parenMatch = trimmed.match(/^\((.+)\)$/);
  if (parenMatch) {
    trimmed = '-' + parenMatch[1];
  }

  // Remove currency symbols and commas
  trimmed = trimmed.replace(/[$€£¥,]/g, '');

  // Validate it's a number
  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return null;
  }

  const negative = num < 0;
  const absolute = Math.abs(num);

  return {
    amount: absolute.toFixed(2),
    negative,
  };
}

/**
 * Splits a CSV line respecting quoted fields.
 * @param line - A single CSV line.
 * @returns Array of field values.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Resolves a column mapping key to a column index.
 * If the key is a number string, treat as zero-based index.
 * Otherwise, look up by header name (case-insensitive).
 */
function resolveColumnIndex(key: string, headers: string[]): number {
  const asIndex = parseInt(key, 10);
  if (!isNaN(asIndex) && String(asIndex) === key) {
    return asIndex;
  }

  const lowerKey = key.toLowerCase();
  return headers.findIndex((h) => h.toLowerCase() === lowerKey);
}

/**
 * Parses CSV content with configurable column mapping.
 * @param content - The CSV file content as a string.
 * @param mapping - Optional column mapping configuration.
 * @returns ParseResult with transactions, errors, and totalRows.
 */
export function parseCsv(content: string, mapping?: ColumnMapping): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: ParseError[] = [];

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { transactions, errors, totalRows: 0 };
  }

  // First line is the header
  const headers = splitCsvLine(lines[0]);

  // Resolve column indices
  const effectiveMapping: ColumnMapping = mapping || {
    date: 'date',
    amount: 'amount',
    description: 'description',
    category: 'category',
  };

  const dateIdx = resolveColumnIndex(effectiveMapping.date, headers);
  const amountIdx = resolveColumnIndex(effectiveMapping.amount, headers);
  const descIdx = effectiveMapping.description
    ? resolveColumnIndex(effectiveMapping.description, headers)
    : -1;
  const catIdx = effectiveMapping.category
    ? resolveColumnIndex(effectiveMapping.category, headers)
    : -1;

  if (dateIdx < 0) {
    errors.push({ line: 1, reason: `Date column "${effectiveMapping.date}" not found` });
    return { transactions, errors, totalRows: 0 };
  }

  if (amountIdx < 0) {
    errors.push({ line: 1, reason: `Amount column "${effectiveMapping.amount}" not found` });
    return { transactions, errors, totalRows: 0 };
  }

  const dataLines = lines.slice(1);
  const totalRows = dataLines.length;

  if (totalRows > MAX_ROWS) {
    errors.push({
      line: 0,
      reason: `File exceeds maximum of ${MAX_ROWS} rows (found ${totalRows})`,
    });
    return { transactions, errors, totalRows };
  }

  for (let i = 0; i < dataLines.length; i++) {
    const lineNumber = i + 2; // 1-based, accounting for header
    const fields = splitCsvLine(dataLines[i]);

    // Validate date
    if (dateIdx >= fields.length || !fields[dateIdx]) {
      errors.push({ line: lineNumber, reason: 'Missing date field' });
      continue;
    }

    const date = parseDate(fields[dateIdx]);
    if (!date) {
      errors.push({ line: lineNumber, reason: `Invalid date: "${fields[dateIdx]}"` });
      continue;
    }

    // Validate amount
    if (amountIdx >= fields.length || !fields[amountIdx]) {
      errors.push({ line: lineNumber, reason: 'Missing amount field' });
      continue;
    }

    const amountResult = parseAmount(fields[amountIdx]);
    if (!amountResult) {
      errors.push({ line: lineNumber, reason: `Invalid amount: "${fields[amountIdx]}"` });
      continue;
    }

    const description =
      descIdx >= 0 && descIdx < fields.length && fields[descIdx]
        ? fields[descIdx]
        : null;

    const category =
      catIdx >= 0 && catIdx < fields.length && fields[catIdx]
        ? fields[catIdx]
        : null;

    transactions.push({
      date,
      amount: amountResult.amount,
      description,
      category,
      type: amountResult.negative ? 'DEBIT' : 'CREDIT',
    });
  }

  return { transactions, errors, totalRows };
}
