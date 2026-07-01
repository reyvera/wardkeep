import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { Budget, BudgetAllocation, Transaction, TransactionType } from '@budgetapp/shared';

import { calculateBudgetProgress, calculateBudgetSummary } from './budget';

/** Helper to create a minimal transaction. */
function makeTx(overrides: Partial<Transaction> & { amount: string; type: TransactionType }): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: null,
    date: new Date('2024-06-15'),
    merchant: null,
    description: null,
    notes: null,
    isReconciliation: false,
    aiCategorized: false,
    aiConfidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Helper to create a minimal allocation. */
function makeAllocation(categoryId: string, amount: string): BudgetAllocation {
  return {
    id: `alloc-${categoryId}`,
    budgetId: 'budget-1',
    categoryId,
    amount,
  };
}

describe('calculateBudgetProgress', () => {
  it('returns empty array when no allocations', () => {
    const result = calculateBudgetProgress([], []);
    expect(result).toEqual([]);
  });

  it('calculates zero spending when no transactions match', () => {
    const allocations = [makeAllocation('cat-food', '500.00')];
    const transactions: Transaction[] = [];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe('cat-food');
    expect(result[0].allocated.eq(new Decimal('500.00'))).toBe(true);
    expect(result[0].spent.eq(new Decimal('0'))).toBe(true);
    expect(result[0].remaining.eq(new Decimal('500.00'))).toBe(true);
    expect(result[0].percentUsed.eq(new Decimal('0'))).toBe(true);
    expect(result[0].status).toBe('ok');
  });

  it('sums only DEBIT transactions for spending', () => {
    const allocations = [makeAllocation('cat-food', '200.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '50.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-food', amount: '30.00', type: TransactionType.CREDIT }),
      makeTx({ id: 'tx-3', categoryId: 'cat-food', amount: '20.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].spent.eq(new Decimal('70.00'))).toBe(true);
    expect(result[0].remaining.eq(new Decimal('130.00'))).toBe(true);
  });

  it('only counts transactions matching the allocation categoryId', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '40.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-transport', amount: '60.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].spent.eq(new Decimal('40.00'))).toBe(true);
  });

  it('assigns "ok" status when spending is below 90%', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '89.99', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('ok');
  });

  it('assigns "warning" status at exactly 90%', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '90.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('warning');
    expect(result[0].percentUsed.eq(new Decimal('90'))).toBe(true);
  });

  it('assigns "warning" status between 90% and 100%', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '95.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('warning');
  });

  it('assigns "overspent" status at exactly 100%', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '100.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('overspent');
    expect(result[0].percentUsed.eq(new Decimal('100'))).toBe(true);
    expect(result[0].remaining.eq(new Decimal('0'))).toBe(true);
  });

  it('assigns "overspent" status when spending exceeds allocation', () => {
    const allocations = [makeAllocation('cat-food', '100.00')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '150.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('overspent');
    expect(result[0].remaining.eq(new Decimal('-50.00'))).toBe(true);
    expect(result[0].percentUsed.eq(new Decimal('150'))).toBe(true);
  });

  it('handles zero allocation without division errors', () => {
    const allocations = [makeAllocation('cat-food', '0')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '10.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].allocated.eq(new Decimal('0'))).toBe(true);
    expect(result[0].spent.eq(new Decimal('10.00'))).toBe(true);
    expect(result[0].percentUsed.eq(new Decimal('0'))).toBe(true);
    expect(result[0].status).toBe('ok');
  });

  it('uses exact decimal arithmetic avoiding floating point errors', () => {
    const allocations = [makeAllocation('cat-food', '0.30')];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '0.10', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-food', amount: '0.10', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-3', categoryId: 'cat-food', amount: '0.10', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    // 0.1 + 0.1 + 0.1 === 0.3 with Decimal.js (not 0.30000000000000004)
    expect(result[0].spent.eq(new Decimal('0.30'))).toBe(true);
    expect(result[0].remaining.eq(new Decimal('0'))).toBe(true);
  });

  it('handles multiple allocations independently', () => {
    const allocations = [
      makeAllocation('cat-food', '200.00'),
      makeAllocation('cat-transport', '100.00'),
    ];
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '180.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-transport', amount: '110.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetProgress(allocations, transactions);

    expect(result[0].status).toBe('warning');
    expect(result[1].status).toBe('overspent');
  });
});

describe('calculateBudgetSummary', () => {
  const baseBudget: Budget = {
    id: 'budget-1',
    userId: 'user-1',
    month: new Date('2024-06-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns zeroes when budget has no allocations', () => {
    const result = calculateBudgetSummary(baseBudget, []);

    expect(result.totalAllocated.eq(new Decimal('0'))).toBe(true);
    expect(result.totalSpent.eq(new Decimal('0'))).toBe(true);
    expect(result.totalRemaining.eq(new Decimal('0'))).toBe(true);
    expect(result.overspentCount).toBe(0);
    expect(result.categoryProgress).toEqual([]);
  });

  it('aggregates totals across all allocations', () => {
    const budget: Budget = {
      ...baseBudget,
      allocations: [
        makeAllocation('cat-food', '300.00'),
        makeAllocation('cat-transport', '150.00'),
      ],
    };
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '100.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-transport', amount: '50.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetSummary(budget, transactions);

    expect(result.totalAllocated.eq(new Decimal('450.00'))).toBe(true);
    expect(result.totalSpent.eq(new Decimal('150.00'))).toBe(true);
    expect(result.totalRemaining.eq(new Decimal('300.00'))).toBe(true);
    expect(result.overspentCount).toBe(0);
    expect(result.categoryProgress).toHaveLength(2);
  });

  it('counts overspent categories correctly', () => {
    const budget: Budget = {
      ...baseBudget,
      allocations: [
        makeAllocation('cat-food', '100.00'),
        makeAllocation('cat-transport', '100.00'),
        makeAllocation('cat-utilities', '100.00'),
      ],
    };
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '120.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-2', categoryId: 'cat-transport', amount: '105.00', type: TransactionType.DEBIT }),
      makeTx({ id: 'tx-3', categoryId: 'cat-utilities', amount: '50.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetSummary(budget, transactions);

    expect(result.overspentCount).toBe(2);
    expect(result.totalAllocated.eq(new Decimal('300.00'))).toBe(true);
    expect(result.totalSpent.eq(new Decimal('275.00'))).toBe(true);
    expect(result.totalRemaining.eq(new Decimal('25.00'))).toBe(true);
  });

  it('computes negative totalRemaining when overall overspent', () => {
    const budget: Budget = {
      ...baseBudget,
      allocations: [makeAllocation('cat-food', '100.00')],
    };
    const transactions = [
      makeTx({ id: 'tx-1', categoryId: 'cat-food', amount: '200.00', type: TransactionType.DEBIT }),
    ];

    const result = calculateBudgetSummary(budget, transactions);

    expect(result.totalRemaining.eq(new Decimal('-100.00'))).toBe(true);
    expect(result.overspentCount).toBe(1);
  });
});
