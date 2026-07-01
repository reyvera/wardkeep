import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';

import { RecurrenceFrequency, RecurringTransaction } from '@budgetapp/shared';

import {
  CashFlowAccount,
  OneTimeEvent,
  expandRecurring,
  projectCashFlow,
} from './cash-flow';

// ─── Test Helpers ───────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<CashFlowAccount> = {}): CashFlowAccount {
  return {
    id: 'acct-1',
    name: 'Checking',
    currentBalance: '1000.00',
    ...overrides,
  };
}

function makeRecurring(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 'rec-1',
    userId: 'user-1',
    accountId: 'acct-1',
    merchant: 'Netflix',
    expectedAmount: '15.99',
    frequency: RecurrenceFrequency.MONTHLY,
    nextExpected: new Date(),
    isConfirmed: true,
    isDismissed: false,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

// ─── expandRecurring ────────────────────────────────────────────────────────────

describe('expandRecurring', () => {
  it('should return empty array for inactive recurring transaction', () => {
    const rec = makeRecurring({ isActive: false, nextExpected: daysFromNow(1) });
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const result = expandRecurring(rec, startDate, 90);

    expect(result).toEqual([]);
  });

  it('should return empty array for dismissed recurring transaction', () => {
    const rec = makeRecurring({ isDismissed: true, nextExpected: daysFromNow(1) });
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    const result = expandRecurring(rec, startDate, 90);

    expect(result).toEqual([]);
  });

  it('should expand weekly recurring across 30 days', () => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const rec = makeRecurring({
      frequency: RecurrenceFrequency.WEEKLY,
      nextExpected: new Date(startDate),
      expectedAmount: '10.00',
    });

    const result = expandRecurring(rec, startDate, 30);

    // 30 days / 7 days per occurrence = ~4-5 occurrences
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(5);
    for (const ev of result) {
      expect(ev.amount.equals(new Decimal('10.00'))).toBe(true);
      expect(ev.type).toBe('debit');
    }
  });

  it('should expand biweekly recurring across 60 days', () => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const rec = makeRecurring({
      frequency: RecurrenceFrequency.BIWEEKLY,
      nextExpected: new Date(startDate),
      expectedAmount: '50.00',
    });

    const result = expandRecurring(rec, startDate, 60);

    // 60 / 14 = ~4-5 occurrences
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('should expand monthly recurring across 90 days', () => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const rec = makeRecurring({
      frequency: RecurrenceFrequency.MONTHLY,
      nextExpected: new Date(startDate),
      expectedAmount: '100.00',
    });

    const result = expandRecurring(rec, startDate, 90);

    // 90 days ~ 3 months
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('should expand quarterly recurring across 90 days', () => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const rec = makeRecurring({
      frequency: RecurrenceFrequency.QUARTERLY,
      nextExpected: new Date(startDate),
      expectedAmount: '200.00',
    });

    const result = expandRecurring(rec, startDate, 90);

    // 90 days ~ 1 quarter
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('should not include occurrences before startDate', () => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    // nextExpected is 10 days before start
    const pastDate = new Date(startDate);
    pastDate.setDate(pastDate.getDate() - 10);

    const rec = makeRecurring({
      frequency: RecurrenceFrequency.WEEKLY,
      nextExpected: pastDate,
      expectedAmount: '25.00',
    });

    const result = expandRecurring(rec, startDate, 30);

    for (const ev of result) {
      expect(ev.date >= startDate).toBe(true);
    }
  });
});

// ─── projectCashFlow ────────────────────────────────────────────────────────────

describe('projectCashFlow', () => {
  it('should return flat projection when no recurring and no one-time events (Req 11.9)', () => {
    const account = makeAccount({ currentBalance: '500.00' });

    const result = projectCashFlow(account, [], [], 30);

    expect(result.projections).toHaveLength(30);
    for (const proj of result.projections) {
      expect(proj.balance.equals(new Decimal('500.00'))).toBe(true);
      expect(proj.credits.equals(new Decimal(0))).toBe(true);
      expect(proj.debits.equals(new Decimal(0))).toBe(true);
    }
    expect(result.belowZeroNotifications).toHaveLength(0);
  });

  it('should default to CASH_FLOW_DAYS (90) when days not specified', () => {
    const account = makeAccount();

    const result = projectCashFlow(account, [], []);

    expect(result.projections).toHaveLength(90);
  });

  it('should incorporate one-time credit events', () => {
    const account = makeAccount({ currentBalance: '100.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(5),
        amount: '200.00',
        type: 'credit',
        description: 'Paycheck',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 30);

    // Day 0-4: balance 100, Day 5+: balance 300
    expect(result.projections[4].balance.equals(new Decimal('100.00'))).toBe(true);
    expect(result.projections[5].balance.equals(new Decimal('300.00'))).toBe(true);
  });

  it('should incorporate one-time debit events', () => {
    const account = makeAccount({ currentBalance: '500.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(3),
        amount: '150.00',
        type: 'debit',
        description: 'Rent',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 30);

    expect(result.projections[2].balance.equals(new Decimal('500.00'))).toBe(true);
    expect(result.projections[3].balance.equals(new Decimal('350.00'))).toBe(true);
  });

  it('should incorporate recurring transactions into projection (Req 11.2)', () => {
    const account = makeAccount({ currentBalance: '200.00' });
    const recurring = [
      makeRecurring({
        frequency: RecurrenceFrequency.WEEKLY,
        nextExpected: daysFromNow(7),
        expectedAmount: '50.00',
      }),
    ];

    const result = projectCashFlow(account, recurring, [], 30);

    // After first occurrence on day 7: 200 - 50 = 150
    expect(result.projections[7].balance.equals(new Decimal('150.00'))).toBe(true);
    // After second occurrence on day 14: 150 - 50 = 100
    expect(result.projections[14].balance.equals(new Decimal('100.00'))).toBe(true);
  });

  it('should detect below-zero projection and generate notification (Req 11.4)', () => {
    const account = makeAccount({ currentBalance: '50.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(2),
        amount: '100.00',
        type: 'debit',
        description: 'Large bill',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 30);

    expect(result.belowZeroNotifications).toHaveLength(1);
    const notification = result.belowZeroNotifications[0];
    expect(notification.accountId).toBe('acct-1');
    expect(notification.accountName).toBe('Checking');
    expect(notification.projectedAmount.equals(new Decimal('-50.00'))).toBe(true);
  });

  it('should only generate one below-zero notification (first crossing)', () => {
    const account = makeAccount({ currentBalance: '30.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(1),
        amount: '50.00',
        type: 'debit',
        description: 'Bill 1',
      },
      {
        date: daysFromNow(3),
        amount: '50.00',
        type: 'debit',
        description: 'Bill 2',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 30);

    // Only one notification even though balance goes further negative
    expect(result.belowZeroNotifications).toHaveLength(1);
    expect(result.belowZeroNotifications[0].projectedAmount.equals(new Decimal('-20.00'))).toBe(
      true,
    );
  });

  it('should handle multiple recurring and one-time events together', () => {
    const account = makeAccount({ currentBalance: '1000.00' });
    const recurring = [
      makeRecurring({
        id: 'rec-1',
        frequency: RecurrenceFrequency.WEEKLY,
        nextExpected: daysFromNow(7),
        expectedAmount: '100.00',
      }),
    ];
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(5),
        amount: '500.00',
        type: 'credit',
        description: 'Salary',
      },
    ];

    const result = projectCashFlow(account, recurring, oneTime, 14);

    // Day 5: 1000 + 500 = 1500
    expect(result.projections[5].balance.equals(new Decimal('1500.00'))).toBe(true);
    // Day 7: 1500 - 100 = 1400
    expect(result.projections[7].balance.equals(new Decimal('1400.00'))).toBe(true);
  });

  it('should use deterministic Decimal arithmetic (Req 11.7)', () => {
    const account = makeAccount({ currentBalance: '0.10' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(1),
        amount: '0.20',
        type: 'credit',
        description: 'Small credit',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 5);

    // 0.1 + 0.2 should equal exactly 0.30, not 0.30000000000000004
    expect(result.projections[1].balance.equals(new Decimal('0.30'))).toBe(true);
  });

  it('should not include one-time events outside the projection window', () => {
    const account = makeAccount({ currentBalance: '100.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(50),
        amount: '999.00',
        type: 'credit',
        description: 'Far future',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 10);

    // Balance should remain flat since the event is outside the 10-day window
    for (const proj of result.projections) {
      expect(proj.balance.equals(new Decimal('100.00'))).toBe(true);
    }
  });

  it('should ignore inactive/dismissed recurring transactions', () => {
    const account = makeAccount({ currentBalance: '500.00' });
    const recurring = [
      makeRecurring({
        isActive: false,
        nextExpected: daysFromNow(1),
        expectedAmount: '100.00',
      }),
      makeRecurring({
        id: 'rec-2',
        isDismissed: true,
        nextExpected: daysFromNow(2),
        expectedAmount: '200.00',
      }),
    ];

    const result = projectCashFlow(account, recurring, [], 30);

    // Balance should remain flat
    for (const proj of result.projections) {
      expect(proj.balance.equals(new Decimal('500.00'))).toBe(true);
    }
  });

  it('should handle credits and debits on the same day correctly', () => {
    const account = makeAccount({ currentBalance: '100.00' });
    const oneTime: OneTimeEvent[] = [
      {
        date: daysFromNow(1),
        amount: '50.00',
        type: 'credit',
        description: 'Refund',
      },
      {
        date: daysFromNow(1),
        amount: '30.00',
        type: 'debit',
        description: 'Bill',
      },
    ];

    const result = projectCashFlow(account, [], oneTime, 5);

    // Day 1: 100 + 50 - 30 = 120
    expect(result.projections[1].balance.equals(new Decimal('120.00'))).toBe(true);
    expect(result.projections[1].credits.equals(new Decimal('50.00'))).toBe(true);
    expect(result.projections[1].debits.equals(new Decimal('30.00'))).toBe(true);
  });
});
