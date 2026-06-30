/**
 * Recurring transaction domain types.
 */

/** Frequency of a recurring transaction. */
export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL',
}

/** Recurring transaction entity matching Prisma schema. */
export interface RecurringTransaction {
  id: string;
  userId: string;
  accountId: string;
  merchant: string;
  /** Stored as string for Decimal.js compatibility during serialization. */
  expectedAmount: string;
  frequency: RecurrenceFrequency;
  nextExpected: Date;
  isConfirmed: boolean;
  isDismissed: boolean;
  isActive: boolean;
  createdAt: Date;
}
