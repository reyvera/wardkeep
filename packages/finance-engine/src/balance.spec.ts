import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { Transaction, TransactionType } from '@budgetapp/shared';

import { calculateBalance } from './balance';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: null,
    date: new Date('2024-01-15'),
    amount: '100.00',
    type: TransactionType.DEBIT,
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

describe('calculateBalance', () => {
  it('returns initial balance when there are no transactions', () => {
    const result = calculateBalance(new Decimal('1000.00'), []);
    expect(result.eq(new Decimal('1000.00'))).toBe(true);
  });

  it('adds credits to the initial balance', () => {
    const transactions = [
      makeTransaction({ amount: '250.50', type: TransactionType.CREDIT }),
    ];
    const result = calculateBalance(new Decimal('1000.00'), transactions);
    expect(result.eq(new Decimal('1250.50'))).toBe(true);
  });

  it('subtracts debits from the initial balance', () => {
    const transactions = [
      makeTransaction({ amount: '300.00', type: TransactionType.DEBIT }),
    ];
    const result = calculateBalance(new Decimal('1000.00'), transactions);
    expect(result.eq(new Decimal('700.00'))).toBe(true);
  });

  it('handles a mix of credits and debits correctly', () => {
    const transactions = [
      makeTransaction({ amount: '500.00', type: TransactionType.CREDIT }),
      makeTransaction({ amount: '200.00', type: TransactionType.DEBIT }),
      makeTransaction({ amount: '50.25', type: TransactionType.CREDIT }),
    ];
    const result = calculateBalance(new Decimal('1000.00'), transactions);
    // 1000 + 500 - 200 + 50.25 = 1350.25
    expect(result.eq(new Decimal('1350.25'))).toBe(true);
  });

  it('handles zero initial balance', () => {
    const transactions = [
      makeTransaction({ amount: '100.00', type: TransactionType.CREDIT }),
      makeTransaction({ amount: '30.00', type: TransactionType.DEBIT }),
    ];
    const result = calculateBalance(new Decimal('0'), transactions);
    expect(result.eq(new Decimal('70.00'))).toBe(true);
  });

  it('can produce a negative balance', () => {
    const transactions = [
      makeTransaction({ amount: '1500.00', type: TransactionType.DEBIT }),
    ];
    const result = calculateBalance(new Decimal('1000.00'), transactions);
    expect(result.eq(new Decimal('-500.00'))).toBe(true);
  });

  it('handles precise decimal values without floating-point errors', () => {
    const transactions = [
      makeTransaction({ amount: '0.1', type: TransactionType.CREDIT }),
      makeTransaction({ amount: '0.2', type: TransactionType.CREDIT }),
    ];
    const result = calculateBalance(new Decimal('0'), transactions);
    // 0.1 + 0.2 should be exactly 0.3, not 0.30000000000000004
    expect(result.eq(new Decimal('0.3'))).toBe(true);
  });

  it('handles large amounts without precision loss', () => {
    const transactions = [
      makeTransaction({ amount: '999999999.99', type: TransactionType.CREDIT }),
      makeTransaction({ amount: '999999999.99', type: TransactionType.DEBIT }),
    ];
    const result = calculateBalance(new Decimal('0.01'), transactions);
    expect(result.eq(new Decimal('0.01'))).toBe(true);
  });
});
