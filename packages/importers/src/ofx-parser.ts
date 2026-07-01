/**
 * OFX/QFX parser using simple string-based extraction.
 * OFX is an SGML-like format; QFX is functionally identical.
 */

import { ParsedTransaction, ParseError, ParseResult } from './types';

const MAX_ROWS = 50_000;

/**
 * Parses an OFX date in YYYYMMDD or YYYYMMDDHHMMSS format to ISO YYYY-MM-DD.
 * @param raw - The raw OFX date string.
 * @returns ISO date string or null if unparseable.
 */
function parseOfxDate(raw: string): string | null {
  const trimmed = raw.trim();
  // OFX dates can be YYYYMMDD or YYYYMMDDHHMMSS[.XXX:tz]
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Extracts the value of an OFX tag from a block of text.
 * OFX tags are like <TAGNAME>value (no closing tag required in SGML mode).
 * @param block - The text block to search in.
 * @param tagName - The OFX tag name (without angle brackets).
 * @returns The tag value or null if not found.
 */
function extractTag(block: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parses OFX/QFX content into transactions.
 * @param content - The OFX/QFX file content as a string.
 * @returns ParseResult with transactions, errors, and totalRows.
 */
export function parseOfx(content: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: ParseError[] = [];

  // Split on <STMTTRN> to find transaction blocks
  const parts = content.split(/<STMTTRN>/i);

  // First part is the header, skip it
  const txBlocks = parts.slice(1);
  const totalRows = txBlocks.length;

  if (totalRows > MAX_ROWS) {
    errors.push({
      line: 0,
      reason: `File exceeds maximum of ${MAX_ROWS} transactions (found ${totalRows})`,
    });
    return { transactions, errors, totalRows };
  }

  for (let i = 0; i < txBlocks.length; i++) {
    const block = txBlocks[i];
    const lineNumber = i + 1; // Logical transaction number

    // Extract date
    const rawDate = extractTag(block, 'DTPOSTED');
    if (!rawDate) {
      errors.push({ line: lineNumber, reason: 'Missing DTPOSTED tag' });
      continue;
    }

    const date = parseOfxDate(rawDate);
    if (!date) {
      errors.push({ line: lineNumber, reason: `Invalid date: "${rawDate}"` });
      continue;
    }

    // Extract amount
    const rawAmount = extractTag(block, 'TRNAMT');
    if (!rawAmount) {
      errors.push({ line: lineNumber, reason: 'Missing TRNAMT tag' });
      continue;
    }

    const num = parseFloat(rawAmount);
    if (isNaN(num)) {
      errors.push({ line: lineNumber, reason: `Invalid amount: "${rawAmount}"` });
      continue;
    }

    const negative = num < 0;
    const amount = Math.abs(num).toFixed(2);

    // Extract description: prefer NAME, fall back to MEMO
    const name = extractTag(block, 'NAME');
    const memo = extractTag(block, 'MEMO');
    const description = name || memo || null;

    transactions.push({
      date,
      amount,
      description,
      category: null,
      type: negative ? 'DEBIT' : 'CREDIT',
    });
  }

  return { transactions, errors, totalRows };
}
