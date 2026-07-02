/**
 * Property-based tests for balance and net-worth calculations.
 *
 * Feature: ai-personal-finance-app
 * Properties 1, 2, 3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Decimal } from 'decimal.js';

import { Transaction, TransactionType, AccountType } from '@wardkeep/shared';

import { calculateBalance } from './balance';
import { calculateNetWorth, AccountWithTransactions } from './net-worth';

// ─── Generators ─────────────────────────────────────────────────────────────────

const amountArb = fc.stringMatching(/^[1-9]\d{0,5}\.\d{2}$/).filter((s) => {
  const d = new Decimal(s);
  return d.gte('0.01') && d.lte('999999.99');
});

const transactionTypeArb = fc.constantFrom(TransactionType.CREDIT, TransactionType.DEBIT);

const transactionArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  accountId: fc.uuid(),
  categoryId: fc.option(fc.uuid(), { nil: null }),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
  amount: amountArb,
  type: transactionTypeArb,
  merchant: fc.option(fc.string(), { nil: null }),
  description: fc.option(fc.string(), { nil: null }),
  notes: fc.option(fc.string(), { nil: null }),
  isReconciliation: fc.boolean(),
  aiCategorized: fc.boolean(),
  aiConfidence: fc.option(fc.string(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
}) as fc.Arbitrary<Transaction>;

const initialBalanceArb = fc.oneof(
  amountArb,
  fc.constant('0.00'),
).map((s) => new Decimal(s));

const assetTypeArb = fc.constantFrom(
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.CASH,
  AccountType.MANUAL,
);

const liabilityTypeArb = fc.constantFrom(
  AccountType.CREDIT_CARD,
  AccountType.LOAN,
  AccountType.MORTGAGE,
  AccountType.HELOC,
);

const accountTypeArb = fc.oneof(assetTypeArb, liabilityTypeArb);

// ─── Property 1 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 1: Account balance is initial balance plus sum of credits minus sum of debits', () => {
  it('balance equals initial + credits - debits', () => {
    fc.assert(
      fc.property(
        initialBalanceArb,
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (initialBalance, transactions) => {
          const result = calculateBalance(initialBalance, transactions);

          const credits = transactions
            .filter((tx) => tx.type === TransactionType.CREDIT)
            .reduce((sum, tx) => sum.plus(new Decimal(tx.amount)), new Decimal(0));

          const debits = transactions
            .filter((tx) => tx.type === TransactionType.DEBIT)
            .reduce((sum, tx) => sum.plus(new Decimal(tx.amount)), new Decimal(0));

          const expected = initialBalance.plus(credits).minus(debits);

          expect(result.eq(expected)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 2: Net worth equals assets minus liabilities excluding archived accounts', () => {
  it('net worth = sum(asset balances) - sum(liability balances), archived excluded', () => {
    const accountWithTxArb = fc.record({
      account: fc.record({
        id: fc.uuid(),
        userId: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
        type: accountTypeArb,
        currency: fc.constant('USD'),
        initialBalance: amountArb,
        isArchived: fc.boolean(),
        createdAt: fc.date(),
        updatedAt: fc.date(),
      }),
      transactions: fc.array(transactionArb, { minLength: 0, maxLength: 10 }),
    }) as fc.Arbitrary<AccountWithTransactions>;

    fc.assert(
      fc.property(
        fc.array(accountWithTxArb, { minLength: 0, maxLength: 10 }),
        (accounts) => {
          const result = calculateNetWorth(accounts);

          let expectedAssets = new Decimal(0);
          let expectedLiabilities = new Decimal(0);

          const ASSET_TYPES = new Set([
            AccountType.CHECKING,
            AccountType.SAVINGS,
            AccountType.CASH,
            AccountType.MANUAL,
          ]);
          const LIABILITY_TYPES = new Set([
            AccountType.CREDIT_CARD,
            AccountType.LOAN,
            AccountType.MORTGAGE,
            AccountType.HELOC,
          ]);

          for (const { account, transactions } of accounts) {
            if (account.isArchived) continue;

            const balance = calculateBalance(
              new Decimal(account.initialBalance),
              transactions,
            );

            if (ASSET_TYPES.has(account.type)) {
              expectedAssets = expectedAssets.plus(balance);
            } else if (LIABILITY_TYPES.has(account.type)) {
              expectedLiabilities = expectedLiabilities.plus(balance);
            }
          }

          const expectedNetWorth = expectedAssets.minus(expectedLiabilities);

          expect(result.assets.eq(expectedAssets)).toBe(true);
          expect(result.liabilities.eq(expectedLiabilities)).toBe(true);
          expect(result.netWorth.eq(expectedNetWorth)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 3 ─────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 3: Transaction deletion adjusts balance correctly', () => {
  it('removing a transaction recalculates balance without it', () => {
    fc.assert(
      fc.property(
        initialBalanceArb,
        fc.array(transactionArb, { minLength: 1, maxLength: 50 }),
        fc.nat(),
        (initialBalance, transactions, indexSeed) => {
          fc.pre(transactions.length > 0);

          const indexToRemove = indexSeed % transactions.length;
          const removedTx = transactions[indexToRemove];
          const remainingTxs = transactions.filter((_, i) => i !== indexToRemove);

          const balanceWithAll = calculateBalance(initialBalance, transactions);
          const balanceWithout = calculateBalance(initialBalance, remainingTxs);

          // Removing a credit should decrease balance; removing a debit should increase it
          const removedAmount = new Decimal(removedTx.amount);
          if (removedTx.type === TransactionType.CREDIT) {
            expect(balanceWithout.eq(balanceWithAll.minus(removedAmount))).toBe(true);
          } else {
            expect(balanceWithout.eq(balanceWithAll.plus(removedAmount))).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
