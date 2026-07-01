import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { Account, AccountType, Transaction, TransactionType } from '@budgetapp/shared';

import { AccountWithTransactions, calculateNetWorth } from './net-worth';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Test Account',
    type: AccountType.CHECKING,
    currency: 'USD',
    initialBalance: '1000.00',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe('calculateNetWorth', () => {
  it('returns zero for an empty accounts array', () => {
    const result = calculateNetWorth([]);
    expect(result.assets.eq(new Decimal('0'))).toBe(true);
    expect(result.liabilities.eq(new Decimal('0'))).toBe(true);
    expect(result.netWorth.eq(new Decimal('0'))).toBe(true);
  });

  it('sums asset account balances correctly', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'a1', type: AccountType.CHECKING, initialBalance: '1000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'a2', type: AccountType.SAVINGS, initialBalance: '5000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'a3', type: AccountType.CASH, initialBalance: '200.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'a4', type: AccountType.MANUAL, initialBalance: '300.00' }),
        transactions: [],
      },
    ];

    const result = calculateNetWorth(accounts);
    expect(result.assets.eq(new Decimal('6500.00'))).toBe(true);
    expect(result.liabilities.eq(new Decimal('0'))).toBe(true);
    expect(result.netWorth.eq(new Decimal('6500.00'))).toBe(true);
  });

  it('sums liability account balances correctly', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'l1', type: AccountType.CREDIT_CARD, initialBalance: '2000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'l2', type: AccountType.LOAN, initialBalance: '10000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'l3', type: AccountType.MORTGAGE, initialBalance: '200000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'l4', type: AccountType.HELOC, initialBalance: '5000.00' }),
        transactions: [],
      },
    ];

    const result = calculateNetWorth(accounts);
    expect(result.assets.eq(new Decimal('0'))).toBe(true);
    expect(result.liabilities.eq(new Decimal('217000.00'))).toBe(true);
    expect(result.netWorth.eq(new Decimal('-217000.00'))).toBe(true);
  });

  it('computes net worth as assets minus liabilities', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'a1', type: AccountType.CHECKING, initialBalance: '5000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({ id: 'l1', type: AccountType.CREDIT_CARD, initialBalance: '2000.00' }),
        transactions: [],
      },
    ];

    const result = calculateNetWorth(accounts);
    expect(result.assets.eq(new Decimal('5000.00'))).toBe(true);
    expect(result.liabilities.eq(new Decimal('2000.00'))).toBe(true);
    expect(result.netWorth.eq(new Decimal('3000.00'))).toBe(true);
  });

  it('excludes archived accounts from net worth', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'a1', type: AccountType.CHECKING, initialBalance: '5000.00' }),
        transactions: [],
      },
      {
        account: makeAccount({
          id: 'a2',
          type: AccountType.SAVINGS,
          initialBalance: '10000.00',
          isArchived: true,
        }),
        transactions: [],
      },
      {
        account: makeAccount({
          id: 'l1',
          type: AccountType.CREDIT_CARD,
          initialBalance: '1000.00',
          isArchived: true,
        }),
        transactions: [],
      },
    ];

    const result = calculateNetWorth(accounts);
    // Only the non-archived checking account counts
    expect(result.assets.eq(new Decimal('5000.00'))).toBe(true);
    expect(result.liabilities.eq(new Decimal('0'))).toBe(true);
    expect(result.netWorth.eq(new Decimal('5000.00'))).toBe(true);
  });

  it('includes transactions in balance calculation for net worth', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'a1', type: AccountType.CHECKING, initialBalance: '1000.00' }),
        transactions: [
          makeTransaction({ amount: '500.00', type: TransactionType.CREDIT }),
          makeTransaction({ amount: '200.00', type: TransactionType.DEBIT }),
        ],
      },
      {
        account: makeAccount({ id: 'l1', type: AccountType.CREDIT_CARD, initialBalance: '3000.00' }),
        transactions: [
          makeTransaction({ amount: '100.00', type: TransactionType.CREDIT }),
        ],
      },
    ];

    const result = calculateNetWorth(accounts);
    // Checking: 1000 + 500 - 200 = 1300
    expect(result.assets.eq(new Decimal('1300.00'))).toBe(true);
    // Credit card: 3000 + 100 = 3100
    expect(result.liabilities.eq(new Decimal('3100.00'))).toBe(true);
    // Net worth: 1300 - 3100 = -1800
    expect(result.netWorth.eq(new Decimal('-1800.00'))).toBe(true);
  });

  it('handles precise decimal calculations without floating-point errors', () => {
    const accounts: AccountWithTransactions[] = [
      {
        account: makeAccount({ id: 'a1', type: AccountType.CHECKING, initialBalance: '0.1' }),
        transactions: [
          makeTransaction({ amount: '0.2', type: TransactionType.CREDIT }),
        ],
      },
      {
        account: makeAccount({ id: 'l1', type: AccountType.LOAN, initialBalance: '0.3' }),
        transactions: [],
      },
    ];

    const result = calculateNetWorth(accounts);
    // Assets: 0.1 + 0.2 = 0.3
    expect(result.assets.eq(new Decimal('0.3'))).toBe(true);
    // Liabilities: 0.3
    expect(result.liabilities.eq(new Decimal('0.3'))).toBe(true);
    // Net worth: 0.3 - 0.3 = 0
    expect(result.netWorth.eq(new Decimal('0'))).toBe(true);
  });
});
