/**
 * Debt profile domain types.
 * A DebtProfile links a liability account to debt-specific metadata
 * (APR, minimum payment, priority) for the debt payoff calculator.
 */

import { AccountType } from './account';

/** Account types that represent debts/liabilities. */
export const DEBT_ACCOUNT_TYPES: AccountType[] = [
  AccountType.CREDIT_CARD,
  AccountType.LOAN,
  AccountType.MORTGAGE,
  AccountType.HELOC,
];

/** DebtProfile entity matching Prisma schema. */
export interface DebtProfile {
  id: string;
  userId: string;
  accountId: string;
  /** APR as a decimal string (e.g. "0.1999" for 19.99%). */
  apr: string;
  /** Minimum monthly payment as a decimal string. */
  minimumPayment: string;
  /** Priority for custom payoff strategy (lower = higher priority). */
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/** DebtProfile with joined account data for the debt calculator. */
export interface DebtProfileWithAccount extends DebtProfile {
  accountName: string;
  accountType: AccountType;
  /** Current balance of the linked account (computed from transactions). */
  currentBalance: string;
}


/** Saved payoff plan entity matching Prisma schema. */
export interface SavedPayoffPlan {
  id: string;
  userId: string;
  name: string;
  /** Account IDs included in this payoff plan. */
  accountIds: string[];
  /** Strategy used: snowball, avalanche, or custom. */
  strategy: string;
  /** Total monthly payment as a decimal string. */
  totalMonthlyPayment: string;
  /** Total interest paid over the life of the plan. */
  totalInterest: string;
  /** Number of months to become debt-free. */
  totalMonths: number;
  createdAt: Date;
}
