import { Decimal } from 'decimal.js';

export interface BurnRateTransaction {
  amount: string | number;
  categoryName?: string | null;
  merchant?: string | null;
  description?: string | null;
}

export interface HouseholdBurnRate {
  normalMonthly: Decimal;
  essentialMonthly: Decimal;
  /** True when category/merchant data was too incomplete to isolate essentials safely. */
  usesNormalFallback: boolean;
  excludedTransferLikeCount: number;
}

const TRANSFER_LIKE = /\b(transfer|payment to|credit card payment|cc payment|card payment|investment|brokerage|savings transfer|principal payment)\b/i;
const ESSENTIAL = /\b(rent|mortgage|utility|utilities|electric|water|gas|insurance|grocery|groceries|health|medical|pharmacy|transport|fuel|gas station|childcare|child care|internet|phone|debt payment)\b/i;

function transactionText(transaction: BurnRateTransaction): string {
  return [transaction.categoryName, transaction.merchant, transaction.description]
    .filter(Boolean)
    .join(' ');
}

/**
 * Calculates normal and essential monthly household burn rates from a fixed window.
 * Transfer records must be excluded by the caller's transaction-type query; this
 * function additionally protects against imported transfers labelled as debits.
 */
export function calculateHouseholdBurnRate(
  transactions: readonly BurnRateTransaction[],
  monthsInWindow = 3,
): HouseholdBurnRate {
  const months = Math.max(monthsInWindow, 1);
  const householdTransactions = transactions.filter((transaction) => !TRANSFER_LIKE.test(transactionText(transaction)));
  const normalTotal = householdTransactions.reduce(
    (total, transaction) => total.add(new Decimal(transaction.amount)),
    new Decimal(0),
  );
  const essentialTransactions = householdTransactions.filter((transaction) => ESSENTIAL.test(transactionText(transaction)));
  const essentialTotal = essentialTransactions.reduce(
    (total, transaction) => total.add(new Decimal(transaction.amount)),
    new Decimal(0),
  );
  const usesNormalFallback = essentialTransactions.length === 0;

  return {
    normalMonthly: normalTotal.div(months),
    essentialMonthly: (usesNormalFallback ? normalTotal : essentialTotal).div(months),
    usesNormalFallback,
    excludedTransferLikeCount: transactions.length - householdTransactions.length,
  };
}
