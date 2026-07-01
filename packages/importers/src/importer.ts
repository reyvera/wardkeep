/**
 * Main entry point for the importers package.
 * Combines CSV/OFX/QFX parsers and CSV export into a unified API.
 */

import { parseCsv } from './csv-parser';
import { parseOfx } from './ofx-parser';
import { exportCsv as exportCsvImpl } from './csv-exporter';
import { ColumnMapping, ImportFormat, ParsedTransaction, ParseResult } from './types';

/** Maximum file size: 10 MB. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Parses a file buffer into transactions based on the specified format.
 *
 * @param buffer - The file content as a Buffer.
 * @param format - The file format ('csv', 'ofx', or 'qfx').
 * @param mapping - Optional column mapping for CSV files.
 * @returns ParseResult containing transactions, errors, and row count.
 * @throws Error if the buffer exceeds 10MB.
 */
export function parse(buffer: Buffer, format: ImportFormat, mapping?: ColumnMapping): ParseResult {
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      transactions: [],
      errors: [
        {
          line: 0,
          reason: `File size ${buffer.length} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (10MB)`,
        },
      ],
      totalRows: 0,
    };
  }

  const content = buffer.toString('utf-8');

  switch (format) {
    case 'csv':
      return parseCsv(content, mapping);
    case 'ofx':
    case 'qfx':
      return parseOfx(content);
    default: {
      const exhaustive: never = format;
      return {
        transactions: [],
        errors: [{ line: 0, reason: `Unsupported format: ${exhaustive}` }],
        totalRows: 0,
      };
    }
  }
}

/**
 * Exports an array of transactions to a CSV Buffer.
 *
 * @param transactions - Array of ParsedTransaction to export.
 * @returns Buffer containing the CSV content.
 */
export function exportCsv(transactions: ParsedTransaction[]): Buffer {
  return exportCsvImpl(transactions);
}
