/**
 * Property-based tests for cash-flow projection.
 *
 * Feature: ai-personal-finance-app
 * Properties 21, 22, 23
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Decimal } from 'decimal.js';

import { RecurringTransaction, RecurrenceFrequency } from '@budgetapp/shared';

import { projectCashFlow, CashFlowAccount, OneTimeEvent } from './cash-flow';

// ─── Generators ─────────────────────────────────────────────────────────────────

const amountArb = fc
  .double({ min: 0.01, max: 999999.99, noNaN: true, noDefaultInfinity: true })
  .map((n) => n.toFixed(2));

const cashFlowAccountArb: fc.Arbitrary<CashFlowAccount> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  currentBalance: amountArb,
});

const frequencyArb: fc.Arbitrary<RecurrenceFrequency> = fc.constantFrom(
  RecurrenceFrequency.WEEKLY,
  RecurrenceFrequency.BIWEEKLY,
  RecurrenceFrequency.MONTHLY,
  RecurrenceFrequency.QUARTERLY,
  RecurrenceFrequency.SEMIANNUAL,
  RecurrenceFrequency.ANNUAL,
);

const recurringTransactionArb: fc.Arbitrary<RecurringTransaction> = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  accountId: fc.uuid(),
  merchant: fc.string({ minLength: 1, maxLength: 20 }),
  expectedAmount: amountArb,
  frequency: frequencyArb,
  nextExpected: fc.date({ min: new Date(), max: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
  isConfirmed: fc.constant(true),
  isDismissed: fc.constant(false),
  isActive: fc.constant(true),
  createdAt: fc.date(),
});

const oneTimeEventArb: fc.Arbitrary<OneTimeEvent> = fc.record({
  date: fc.date({ min: new Date(), max: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }),
  amount: amountArb,
  type: fc.constantFrom('credit' as const, 'debit' as const),
  description: fc.string({ minLength: 1, maxLength: 20 }),
});

// ─── Property 21 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 21: Cash-flow projection deterministically computes daily balances', () => {
  it('same input produces same output (deterministic)', () => {
    fc.assert(
      fc.property(
        cashFlowAccountArb,
        fc.array(recurringTransactionArb, { minLength: 0, maxLength: 5 }),
        fc.array(oneTimeEventArb, { minLength: 0, maxLength: 5 }),
        fc.integer({ min: 7, max: 90 }),
        (account, recurring, oneTime, days) => {
          const result1 = projectCashFlow(account, recurring, oneTime, days);
          const result2 = projectCashFlow(account, recurring, oneTime, days);

          // Same number of projections
          expect(result1.projections.length).toBe(result2.projections.length);

          // Each daily balance must be identical
          for (let i = 0; i < result1.projections.length; i++) {
            expect(result1.projections[i].balance.eq(result2.projections[i].balance)).toBe(true);
            expect(result1.projections[i].credits.eq(result2.projections[i].credits)).toBe(true);
            expect(result1.projections[i].debits.eq(result2.projections[i].debits)).toBe(true);
          }

          // Same notifications
          expect(result1.belowZeroNotifications.length).toBe(
            result2.belowZeroNotifications.length,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 22 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 22: Below-zero projection generates notification with correct details', () => {
  it('notification fires when balance goes negative with correct account details', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 20 }),
        amountArb,
        (accountId, accountName, debitAmountStr) => {
          // Start with a small balance and create a large debit to force below zero
          const smallBalance = '10.00';
          const debitAmount = new Decimal(debitAmountStr);
          fc.pre(debitAmount.gt(new Decimal('10.00')));

          const account: CashFlowAccount = {
            id: accountId,
            name: accountName,
            currentBalance: smallBalance,
          };

          // Create a one-time debit that will push balance below zero tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);

          const oneTimeEvents: OneTimeEvent[] = [
            {
              date: tomorrow,
              amount: debitAmountStr,
              type: 'debit',
              description: 'Large payment',
            },
          ];

          const result = projectCashFlow(account, [], oneTimeEvents, 7);

          // Should generate a below-zero notification
          expect(result.belowZeroNotifications.length).toBe(1);
          expect(result.belowZeroNotifications[0].accountId).toBe(accountId);
          expect(result.belowZeroNotifications[0].accountName).toBe(accountName);
          expect(result.belowZeroNotifications[0].projectedAmount.isNegative()).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 23 ────────────────────────────────────────────────────────────────

describe('Feature: ai-personal-finance-app, Property 23: No recurring transactions implies flat projection', () => {
  it('with no recurring and no one-time events, balance stays constant', () => {
    fc.assert(
      fc.property(
        cashFlowAccountArb,
        fc.integer({ min: 7, max: 90 }),
        (account, days) => {
          const result = projectCashFlow(account, [], [], days);

          const startBalance = new Decimal(account.currentBalance);

          // Every day should have the same balance
          for (const projection of result.projections) {
            expect(projection.balance.eq(startBalance)).toBe(true);
            expect(projection.credits.eq(new Decimal(0))).toBe(true);
            expect(projection.debits.eq(new Decimal(0))).toBe(true);
          }

          // No below-zero notifications (balance is positive from generator)
          expect(result.belowZeroNotifications.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
