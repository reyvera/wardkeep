/**
 * Shared types for the importers package.
 */

/** Column mapping configuration for CSV parsing. */
export interface ColumnMapping {
  /** Column name or zero-based index for the date field. */
  date: string;
  /** Column name or zero-based index for the amount field. */
  amount: string;
  /** Column name or zero-based index for the description field. */
  description?: string;
  /** Column name or zero-based index for the category field. */
  category?: string;
}

/** A single parsed transaction from an imported file. */
export interface ParsedTransaction {
  /** ISO date string in YYYY-MM-DD format. */
  date: string;
  /** Decimal string representing the absolute amount. */
  amount: string;
  /** Transaction description, if available. */
  description: string | null;
  /** Transaction category, if available. */
  category: string | null;
  /** Inferred from the sign of the original amount. */
  type: 'DEBIT' | 'CREDIT';
}

/** Represents a parsing error for a specific line. */
export interface ParseError {
  /** 1-based line number where the error occurred. */
  line: number;
  /** Human-readable reason for the error. */
  reason: string;
}

/** Result of parsing an import file. */
export interface ParseResult {
  /** Successfully parsed transactions. */
  transactions: ParsedTransaction[];
  /** Lines that could not be parsed. */
  errors: ParseError[];
  /** Total number of data rows encountered (excluding header). */
  totalRows: number;
}

/** Supported import file formats. */
export type ImportFormat = 'csv' | 'ofx' | 'qfx';
