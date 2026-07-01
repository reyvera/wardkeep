/**
 * Cash-flow projection engine.
 *
 * Projects daily account balances forward by expanding recurring transactions
 * and one-time events into a daily timeline, detecting below-zero crossings.
 */
import { Decimal } from 'decimal.js';

import { RecurringTransaction, RecurrenceFrequency, CASH_FLOW_DAYS } from '@budgetapp/shared';

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Simplified account input for cash-flow projections. */
export interface CashFlowAccount {
  id: string;
  name: string;
  /** Current calculated balance as a decimal string. */
  currentBalance: string;
}

/** A one-time future event (bill, payment, deposit). */
export interface OneTimeEvent {
  date: Date;
  /** Decimal string amount. */
  amount: string;
  type: 'credit' | 'debit';
  description: string;
}

/** A single day's projection data. */
export interface DailyProjection {
  date: Date;
  credits: Decimal;
  debits: Decimal;
  balance: Decimal;
}

/** Notification generated when projected balance falls below zero. */
export interface BelowZeroNotification {
  accountId: string;
  accountName: string;
  date: Date;
  projectedAmount: Decimal;
}

/** Result of a cash-flow projection run. */
export interface CashFlowResult {
  projections: DailyProjection[];
  belowZeroNotifications: BelowZeroNotification[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns a date-only key string (YYYY-MM-DD) for map lookups, ignoring time.
 *
 * @param date - The date to convert.
 * @returns ISO date string without time component.
 */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds a given number of months to a date, clamping to end of month if needed.
 *
 * @param base - The starting date.
 * @param months - Number of months to add.
 * @returns A new Date with the months added.
 */
function addMonths(base: Date, months: number): Date {
  const result = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  // Clamp: if original day was 31 but new month only has 30 days, JS rolls over.
  // Detect by checking if month shifted too far.
  if (result.getDate() !== base.getDate()) {
    // Set to last day of the intended month
    return new Date(base.getFullYear(), base.getMonth() + months + 1, 0);
  }
  return result;
}

/**
 * Adds a given number of days to a date.
 *
 * @param base - The starting date.
 * @param days - Number of days to add.
 * @returns A new Date with the days added.
 */
function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

/** Internal representation of a daily event (credit or debit). */
interface DailyEvent {
  amount: Decimal;
  type: 'credit' | 'debit';
}

/**
 * Expands a recurring transaction into individual daily events within the projection window.
 *
 * @param recurring - The recurring transaction to expand.
 * @param startDate - The first day of the projection window.
 * @param days - Number of days in the projection window.
 * @returns Array of dated events generated from the recurrence pattern.
 */
export function expandRecurring(
  recurring: RecurringTransaction,
  startDate: Date,
  days: number,
): { date: Date; amount: Decimal; type: 'credit' | 'debit' }[] {
  if (!recurring.isActive || recurring.isDismissed) {
    return [];
  }

  const events: { date: Date; amount: Decimal; type: 'credit' | 'debit' }[] = [];
  const endDate = addDays(startDate, days);
  let current = new Date(recurring.nextExpected);

  while (current < endDate) {
    if (current >= startDate) {
      events.push({
        date: new Date(current),
        amount: new Decimal(recurring.expectedAmount),
        type: 'debit',
      });
    }
    current = advanceByFrequency(current, recurring.frequency);
  }

  return events;
}

/**
 * Advances a date by the interval defined by the given recurrence frequency.
 *
 * @param date - The current occurrence date.
 * @param frequency - The recurrence frequency enum value.
 * @returns The next occurrence date.
 */
function advanceByFrequency(date: Date, frequency: RecurrenceFrequency): Date {
  switch (frequency) {
    case RecurrenceFrequency.WEEKLY:
      return addDays(date, 7);
    case RecurrenceFrequency.BIWEEKLY:
      return addDays(date, 14);
    case RecurrenceFrequency.MONTHLY:
      return addMonths(date, 1);
    case RecurrenceFrequency.QUARTERLY:
      return addMonths(date, 3);
    case RecurrenceFrequency.SEMIANNUAL:
      return addMonths(date, 6);
    case RecurrenceFrequency.ANNUAL:
      return addMonths(date, 12);
  }
}

// ─── Main Projection ────────────────────────────────────────────────────────────

/**
 * Projects daily account balances forward, incorporating recurring transactions
 * and one-time events. Detects below-zero crossings and generates notifications.
 *
 * @param account - The account with its current calculated balance.
 * @param recurring - Active recurring transactions for this account.
 * @param oneTimeEvents - One-time future events (bills, deposits).
 * @param days - Number of days to project (defaults to CASH_FLOW_DAYS = 90).
 * @returns Projection results including daily balances and below-zero notifications.
 */
export function projectCashFlow(
  account: CashFlowAccount,
  recurring: RecurringTransaction[],
  oneTimeEvents: OneTimeEvent[],
  days: number = CASH_FLOW_DAYS,
): CashFlowResult {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  // Build a map of date -> events
  const eventMap = new Map<string, DailyEvent[]>();

  const addEvent = (key: string, event: DailyEvent) => {
    const existing = eventMap.get(key) ?? [];
    existing.push(event);
    eventMap.set(key, existing);
  };

  // Expand recurring transactions
  for (const rec of recurring) {
    const expanded = expandRecurring(rec, startDate, days);
    for (const ev of expanded) {
      addEvent(dateKey(ev.date), { amount: ev.amount, type: ev.type });
    }
  }

  // Add one-time events
  for (const ot of oneTimeEvents) {
    const otDate = new Date(ot.date);
    otDate.setHours(0, 0, 0, 0);
    const key = dateKey(otDate);
    if (otDate >= startDate && otDate < addDays(startDate, days)) {
      addEvent(key, { amount: new Decimal(ot.amount), type: ot.type });
    }
  }

  // Generate daily projections
  const projections: DailyProjection[] = [];
  const belowZeroNotifications: BelowZeroNotification[] = [];
  let balance = new Decimal(account.currentBalance);
  let belowZeroDetected = false;

  for (let i = 0; i < days; i++) {
    const day = addDays(startDate, i);
    const key = dateKey(day);
    const events = eventMap.get(key) ?? [];

    let dailyCredits = new Decimal(0);
    let dailyDebits = new Decimal(0);

    for (const ev of events) {
      if (ev.type === 'credit') {
        dailyCredits = dailyCredits.plus(ev.amount);
      } else {
        dailyDebits = dailyDebits.plus(ev.amount);
      }
    }

    balance = balance.plus(dailyCredits).minus(dailyDebits);

    projections.push({
      date: day,
      credits: dailyCredits,
      debits: dailyDebits,
      balance,
    });

    // Detect first below-zero crossing
    if (!belowZeroDetected && balance.isNegative()) {
      belowZeroDetected = true;
      belowZeroNotifications.push({
        accountId: account.id,
        accountName: account.name,
        date: day,
        projectedAmount: balance,
      });
    }
  }

  return { projections, belowZeroNotifications };
}
