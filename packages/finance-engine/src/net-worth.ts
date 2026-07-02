/**
 * Net worth calculation separating assets from liabilities, excluding archived accounts.
 */
import { Decimal } from 'decimal.js';

import { Account, AccountType, Transaction } from '@wardkeep/shared';

import { calculateBalance } from './balance';

/** Asset account types contribute positively to net worth. */
const ASSET_TYPES: ReadonlySet<AccountType> = new Set([
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.CASH,
  AccountType.MANUAL,
]);

/** Liability account types contribute negatively to net worth. */
const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set([
  AccountType.CREDIT_CARD,
  AccountType.LOAN,
  AccountType.MORTGAGE,
  AccountType.HELOC,
]);

/** Summary of net worth broken down into assets and liabilities. */
export interface NetWorthSummary {
  /** Total balance of all active asset accounts. */
  assets: Decimal;
  /** Total balance of all active liability accounts. */
  liabilities: Decimal;
  /** Net worth = assets - liabilities. */
  netWorth: Decimal;
}

/** An account paired with its transactions for balance computation. */
export interface AccountWithTransactions {
  account: Account;
  transactions: Transaction[];
}

/**
 * Calculates the net worth summary from a set of accounts and their transactions.
 *
 * Net worth = sum(active asset balances) - sum(active liability balances).
 * Archived accounts are excluded from the calculation entirely.
 *
 * @param accounts - Array of accounts paired with their transactions.
 * @returns A NetWorthSummary with assets, liabilities, and net worth.
 */
export function calculateNetWorth(accounts: AccountWithTransactions[]): NetWorthSummary {
  let assets = new Decimal(0);
  let liabilities = new Decimal(0);

  for (const { account, transactions } of accounts) {
    if (account.isArchived) {
      continue;
    }

    const balance = calculateBalance(new Decimal(account.initialBalance), transactions);

    if (ASSET_TYPES.has(account.type)) {
      assets = assets.plus(balance);
    } else if (LIABILITY_TYPES.has(account.type)) {
      liabilities = liabilities.plus(balance);
    }
  }

  return {
    assets,
    liabilities,
    netWorth: assets.minus(liabilities),
  };
}
