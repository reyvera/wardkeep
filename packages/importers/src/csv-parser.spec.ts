/**
 * Property-based tests for CSV parser and exporter round-trip.
 *
 * Feature: ai-personal-finance-app
 * Properties 5, 6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { parse, exportCsv } from './importer';
import { parseCsv } from './csv-parser';
import { ParsedTransaction } from './types';

// ─── Generators ─────────────────────────────────────────────────────────────────

/** Generate a valid ISO date string (YYYY-MM-DD). */
const dateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([year, month, day]) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });

/** Generate a valid amount string with 2 decimal places (no leading zeros). */
const amountArb = fc
  .tuple(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, frac]) => `${whole}.${String(frac).padStart(2, '0')}`);

const typeArb = fc.constantFrom<'CREDIT' | 'DEBIT'>('CREDIT', 'DEBIT');

/**
 * Generate a safe description: non-empty, no newlines, no leading/trailing whitespace.
 * Avoids characters that would break CSV round-tripping in edge cases.
 */
const safeStringArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .map((s) => s.replace(/[\n\r]/g, ' ').trim())
  .filter((s) => s.length > 0);

/** Generate a ParsedTransaction with valid fields. */
const transactionArb: fc.Arbitrary<ParsedTransaction> = fc.record({
  date: dateArb,
  amount: amountArb,
  description: fc.oneof(safeStringArb, fc.constant(null)),
  category: fc.oneof(safeStringArb, fc.constant(null)),
  type: typeArb,
});

// ─── Property 5 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 5: Import round-trip preserves transaction data', () => {
  it('parse → export → re-parse produces matching data', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 1, maxLength: 30 }),
        (transactions) => {
          // Export to CSV buffer
          const csvBuffer = exportCsv(transactions);

          // Re-parse with the same column mapping the exporter uses
          const result = parse(csvBuffer, 'csv', {
            date: 'date',
            amount: 'amount',
            description: 'description',
            category: 'category',
          });

          // Should have no errors and same number of transactions
          expect(result.errors).toHaveLength(0);
          expect(result.transactions).toHaveLength(transactions.length);

          // Each transaction should match
          for (let i = 0; i < transactions.length; i++) {
            const original = transactions[i];
            const reimported = result.transactions[i];

            expect(reimported.date).toBe(original.date);
            expect(reimported.amount).toBe(original.amount);
            expect(reimported.type).toBe(original.type);

            // Null descriptions/categories export as empty strings and re-parse as null
            if (original.description) {
              expect(reimported.description).toBe(original.description);
            } else {
              expect(reimported.description).toBeNull();
            }

            if (original.category) {
              expect(reimported.category).toBe(original.category);
            } else {
              expect(reimported.category).toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 6: Malformed import rows are skipped without blocking valid rows', () => {
  it('malformed rows produce errors but valid rows still parse', () => {
    /** Generate a valid CSV row (without header). */
    const validRowArb = fc
      .tuple(dateArb, amountArb, safeStringArb)
      .map(([date, amount, desc]) => `${date},${amount},${desc}`);

    /** Generate a malformed CSV row that will fail parsing. */
    const malformedRowArb = fc.oneof(
      // Bad date
      fc
        .tuple(
          fc.stringMatching(/^[xyz!?]{3,8}$/),
          amountArb,
        )
        .map(([badDate, amount]) => `${badDate},${amount},Bad date row`),
      // Bad amount
      fc
        .tuple(dateArb, fc.stringMatching(/^[abc]{2,6}$/))
        .map(([date, badAmount]) => `${date},${badAmount},Bad amount row`),
      // Missing fields (just a single value)
      fc.constant('single-value-only'),
    );

    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 20 }),
        fc.array(malformedRowArb, { minLength: 1, maxLength: 10 }),
        (validRows, malformedRows) => {
          // Interleave valid and malformed rows
          const shuffled: string[] = [];
          let vi = 0;
          let mi = 0;
          const total = validRows.length + malformedRows.length;
          for (let i = 0; i < total; i++) {
            if (i % 2 === 0 && vi < validRows.length) {
              shuffled.push(validRows[vi++]);
            } else if (mi < malformedRows.length) {
              shuffled.push(malformedRows[mi++]);
            } else if (vi < validRows.length) {
              shuffled.push(validRows[vi++]);
            }
          }
          // Append remaining
          while (vi < validRows.length) shuffled.push(validRows[vi++]);
          while (mi < malformedRows.length) shuffled.push(malformedRows[mi++]);

          const csv = ['date,amount,description', ...shuffled].join('\n');
          const result = parseCsv(csv);

          // Valid rows should all be parsed
          expect(result.transactions.length).toBe(validRows.length);

          // Malformed rows should produce errors
          expect(result.errors.length).toBeGreaterThanOrEqual(malformedRows.length);

          // Total rows should be all data rows
          expect(result.totalRows).toBe(shuffled.length);

          // All parsed transactions should have valid date format
          for (const tx of result.transactions) {
            expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(parseFloat(tx.amount)).toBeGreaterThan(0);
            expect(['CREDIT', 'DEBIT']).toContain(tx.type);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
