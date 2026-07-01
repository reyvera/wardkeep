/**
 * AI claim verification — independently computes numerical values
 * to verify claims made by the AI chat engine.
 */
import { Decimal } from 'decimal.js';

/** Types of numerical claims the AI can make. */
export type ClaimType =
  | 'account_balance'
  | 'net_worth'
  | 'category_spending'
  | 'total_spending'
  | 'budget_remaining'
  | 'monthly_income';

/** A numerical claim made by the AI. */
export interface NumericalClaim {
  type: ClaimType;
  /** The value the AI claims is correct (as Decimal string). */
  claimedValue: string;
  /** Context to identify what is being claimed. */
  accountId?: string;
  categoryId?: string;
  month?: string; // ISO date string
}

/** Financial context needed to verify claims. */
export interface FinancialContext {
  accounts: Array<{
    id: string;
    initialBalance: string;
    type: string; // AccountType
    isArchived: boolean;
    transactions: Array<{
      amount: string;
      type: string; // TransactionType: 'DEBIT' | 'CREDIT'
      categoryId: string | null;
      date: Date;
    }>;
  }>;
  /** Budget allocations for budget_remaining verification. */
  budgetAllocations?: Array<{
    categoryId: string;
    amount: string;
    month: string; // ISO date string
  }>;
}

/** Result of verifying an AI claim. */
export interface VerificationResult {
  isCorrect: boolean;
  /** The independently computed correct value. */
  verifiedValue: Decimal;
  /** The AI's claimed value. */
  claimedValue: Decimal;
  /** Warning message if there's a discrepancy. */
  correctionWarning?: string;
}

/**
 * Checks whether a transaction date falls within the specified month.
 * Uses UTC to avoid timezone-related discrepancies.
 *
 * @param txDate - The transaction date.
 * @param monthIso - ISO date string representing the first day of the month (e.g., '2024-03-01').
 * @returns True if the transaction is in the specified month.
 */
function isInMonth(txDate: Date, monthIso: string): boolean {
  const monthDate = new Date(monthIso);
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const txYear = txDate.getUTCFullYear();
  const txMonth = txDate.getUTCMonth();
  return txYear === year && txMonth === month;
}

/**
 * Computes the balance for a specific account by summing its transactions
 * against the initial balance.
 *
 * @param account - The account with its transactions.
 * @returns The computed balance as a Decimal.
 */
function computeAccountBalance(account: FinancialContext['accounts'][number]): Decimal {
  const initial = new Decimal(account.initialBalance);
  return account.transactions.reduce((balance, tx) => {
    const amount = new Decimal(tx.amount);
    if (tx.type === 'CREDIT') {
      return balance.plus(amount);
    }
    return balance.minus(amount);
  }, initial);
}

/** Asset account types that contribute positively to net worth. */
const ASSET_TYPES = new Set(['CHECKING', 'SAVINGS', 'CASH', 'MANUAL']);

/** Liability account types that contribute negatively to net worth. */
const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'LOAN', 'MORTGAGE', 'HELOC']);

/**
 * Computes net worth from all non-archived accounts.
 *
 * @param accounts - All accounts with transactions.
 * @returns Net worth as a Decimal.
 */
function computeNetWorth(accounts: FinancialContext['accounts']): Decimal {
  let assets = new Decimal(0);
  let liabilities = new Decimal(0);

  for (const account of accounts) {
    if (account.isArchived) {
      continue;
    }
    const balance = computeAccountBalance(account);
    if (ASSET_TYPES.has(account.type)) {
      assets = assets.plus(balance);
    } else if (LIABILITY_TYPES.has(account.type)) {
      liabilities = liabilities.plus(balance);
    }
  }

  return assets.minus(liabilities);
}

/**
 * Computes total spending (debits) for a specific category, optionally filtered by month.
 *
 * @param accounts - All accounts with transactions.
 * @param categoryId - The category to filter by.
 * @param month - Optional month filter (ISO date string).
 * @returns Total category spending as a Decimal.
 */
function computeCategorySpending(
  accounts: FinancialContext['accounts'],
  categoryId: string,
  month?: string,
): Decimal {
  let total = new Decimal(0);

  for (const account of accounts) {
    for (const tx of account.transactions) {
      if (tx.type !== 'DEBIT' || tx.categoryId !== categoryId) {
        continue;
      }
      if (month && !isInMonth(tx.date, month)) {
        continue;
      }
      total = total.plus(new Decimal(tx.amount));
    }
  }

  return total;
}

/**
 * Computes total spending (all debits) across all accounts, optionally filtered by month.
 *
 * @param accounts - All accounts with transactions.
 * @param month - Optional month filter (ISO date string).
 * @returns Total spending as a Decimal.
 */
function computeTotalSpending(
  accounts: FinancialContext['accounts'],
  month?: string,
): Decimal {
  let total = new Decimal(0);

  for (const account of accounts) {
    for (const tx of account.transactions) {
      if (tx.type !== 'DEBIT') {
        continue;
      }
      if (month && !isInMonth(tx.date, month)) {
        continue;
      }
      total = total.plus(new Decimal(tx.amount));
    }
  }

  return total;
}

/**
 * Computes budget remaining for a category in a given month:
 * allocated amount minus actual spending for that category/month.
 *
 * @param context - Financial context including budget allocations.
 * @param categoryId - The category to check.
 * @param month - The month (ISO date string).
 * @returns Budget remaining as a Decimal.
 */
function computeBudgetRemaining(
  context: FinancialContext,
  categoryId: string,
  month: string,
): Decimal {
  const allocation = (context.budgetAllocations ?? []).find(
    (a) => a.categoryId === categoryId && a.month === month,
  );
  const allocated = allocation ? new Decimal(allocation.amount) : new Decimal(0);
  const spent = computeCategorySpending(context.accounts, categoryId, month);
  return allocated.minus(spent);
}

/**
 * Computes total monthly income (credits) across all accounts for a given month.
 *
 * @param accounts - All accounts with transactions.
 * @param month - The month (ISO date string).
 * @returns Monthly income as a Decimal.
 */
function computeMonthlyIncome(
  accounts: FinancialContext['accounts'],
  month: string,
): Decimal {
  let total = new Decimal(0);

  for (const account of accounts) {
    for (const tx of account.transactions) {
      if (tx.type !== 'CREDIT') {
        continue;
      }
      if (!isInMonth(tx.date, month)) {
        continue;
      }
      total = total.plus(new Decimal(tx.amount));
    }
  }

  return total;
}

/**
 * Independently computes the correct value for a claim type.
 *
 * @param claim - The AI's numerical claim.
 * @param context - The financial data needed to verify.
 * @returns The independently computed value.
 */
function computeVerifiedValue(claim: NumericalClaim, context: FinancialContext): Decimal {
  switch (claim.type) {
    case 'account_balance': {
      const account = context.accounts.find((a) => a.id === claim.accountId);
      if (!account) {
        return new Decimal(0);
      }
      return computeAccountBalance(account);
    }
    case 'net_worth':
      return computeNetWorth(context.accounts);
    case 'category_spending':
      return computeCategorySpending(
        context.accounts,
        claim.categoryId ?? '',
        claim.month,
      );
    case 'total_spending':
      return computeTotalSpending(context.accounts, claim.month);
    case 'budget_remaining':
      return computeBudgetRemaining(
        context,
        claim.categoryId ?? '',
        claim.month ?? '',
      );
    case 'monthly_income':
      return computeMonthlyIncome(context.accounts, claim.month ?? '');
  }
}

/**
 * Verifies a numerical claim made by the AI by independently computing the value
 * using deterministic arithmetic. If any non-zero discrepancy exists, returns
 * isCorrect = false with a correction warning.
 *
 * @param claim - The AI's numerical claim to verify.
 * @param context - Financial data needed to compute the verified value.
 * @returns A VerificationResult with the comparison outcome.
 */
export function verifyAIClaim(claim: NumericalClaim, context: FinancialContext): VerificationResult {
  const verifiedValue = computeVerifiedValue(claim, context);
  const claimedValue = new Decimal(claim.claimedValue);

  const isCorrect = claimedValue.eq(verifiedValue);

  if (isCorrect) {
    return { isCorrect: true, verifiedValue, claimedValue };
  }

  return {
    isCorrect: false,
    verifiedValue,
    claimedValue,
    correctionWarning:
      `AI claimed ${claimedValue.toFixed(2)} but verified value is ${verifiedValue.toFixed(2)}. ` +
      `Displaying corrected value.`,
  };
}
