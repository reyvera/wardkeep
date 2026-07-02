/**
 * Property-based tests for budget calculations.
 *
 * Feature: ai-personal-finance-app
 * Properties 9, 10
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Decimal } from 'decimal.js';

import { Transaction, TransactionType, BudgetAllocation } from '@wardkeep/shared';

import { calculateBudgetProgress, CategoryProgress } from './budget';

// ─── Generators ─────────────────────────────────────────────────────────────────

const amountArb = fc.stringMatching(/^[1-9]\d{0,5}\.\d{2}$/).filter((s) => {
  const d = new Decimal(s);
  return d.gte('0.01') && d.lte('999999.99');
});

/** Generate a category ID from a fixed pool so transactions can match allocations. */
const categoryIdArb = fc.constantFrom('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5');

const allocationArb = (categoryId: string): fc.Arbitrary<BudgetAllocation> =>
  fc.record({
    id: fc.uuid(),
    budgetId: fc.uuid(),
    categoryId: fc.constant(categoryId),
    amount: amountArb,
  });

const debitTransactionArb = (categoryId: string): fc.Arbitrary<Transaction> =>
  fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    accountId: fc.uuid(),
    categoryId: fc.constant(categoryId as string | null),
    date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    amount: amountArb,
    type: fc.constant(TransactionType.DEBIT),
    merchant: fc.option(fc.string(), { nil: null }),
    description: fc.option(fc.string(), { nil: null }),
    notes: fc.option(fc.string(), { nil: null }),
    isReconciliation: fc.constant(false),
    aiCategorized: fc.constant(false),
    aiConfidence: fc.constant(null),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  }) as fc.Arbitrary<Transaction>;

// ─── Property 9 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 9: Budget actual spending equals sum of category expenses in period', () => {
  it('spent for each category equals sum of matching DEBIT transactions', () => {
    fc.assert(
      fc.property(
        fc.array(categoryIdArb, { minLength: 1, maxLength: 5 }).chain((categoryIds) => {
          const uniqueIds = [...new Set(categoryIds)];
          const allocations = fc.tuple(
            ...uniqueIds.map((id) => allocationArb(id)),
          );
          const transactions = fc.array(
            fc.oneof(...uniqueIds.map((id) => debitTransactionArb(id))),
            { minLength: 0, maxLength: 30 },
          );
          return fc.tuple(allocations, transactions, fc.constant(uniqueIds));
        }),
        ([allocations, transactions, categoryIds]) => {
          const progress = calculateBudgetProgress(
            allocations as BudgetAllocation[],
            transactions,
          );

          for (const cp of progress) {
            const expectedSpent = transactions
              .filter(
                (tx) =>
                  tx.type === TransactionType.DEBIT &&
                  tx.categoryId === cp.categoryId,
              )
              .reduce((sum, tx) => sum.plus(new Decimal(tx.amount)), new Decimal(0));

            expect(cp.spent.eq(expectedSpent)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 10: Budget threshold notifications fire at correct percentages', () => {
  it('status is warning at >=90% and overspent at >=100%', () => {
    fc.assert(
      fc.property(
        amountArb,
        fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }),
        (allocatedStr, spentRatio) => {
          const allocated = new Decimal(allocatedStr);
          fc.pre(allocated.gt(0));

          // Create a single allocation
          const categoryId = 'cat-test';
          const allocation: BudgetAllocation = {
            id: 'alloc-1',
            budgetId: 'budget-1',
            categoryId,
            amount: allocatedStr,
          };

          // Generate a transaction that results in the desired spending ratio
          const spentAmount = allocated.times(new Decimal(spentRatio)).toDecimalPlaces(2);
          fc.pre(spentAmount.gte('0.01'));

          const transaction: Transaction = {
            id: 'tx-1',
            userId: 'user-1',
            accountId: 'acc-1',
            categoryId,
            date: new Date('2024-06-15'),
            amount: spentAmount.toString(),
            type: TransactionType.DEBIT,
            merchant: null,
            description: null,
            notes: null,
            isReconciliation: false,
            aiCategorized: false,
            aiConfidence: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const [progress] = calculateBudgetProgress([allocation], [transaction]);

          const ratio = spentAmount.div(allocated);

          if (ratio.gte(new Decimal('1'))) {
            expect(progress.status).toBe('overspent');
          } else if (ratio.gte(new Decimal('0.9'))) {
            expect(progress.status).toBe('warning');
          } else {
            expect(progress.status).toBe('ok');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
