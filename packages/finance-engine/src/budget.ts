/**
 * Budget calculation functions using exact decimal arithmetic.
 */
import { Decimal } from 'decimal.js';

import { Budget, BudgetAllocation, Transaction, TransactionType } from '@budgetapp/shared';

/** Budget status thresholds. */
const WARNING_THRESHOLD = new Decimal('0.9');
const OVERSPENT_THRESHOLD = new Decimal('1');

/** Status of a category's budget progress. */
export type BudgetStatus = 'ok' | 'warning' | 'overspent';

/** Progress details for a single budget category. */
export interface CategoryProgress {
  categoryId: string;
  allocated: Decimal;
  spent: Decimal;
  remaining: Decimal;
  /** Percentage of allocation used (0–100+ scale). */
  percentUsed: Decimal;
  status: BudgetStatus;
}

/** Summary of an entire budget across all categories. */
export interface BudgetSummary {
  totalAllocated: Decimal;
  totalSpent: Decimal;
  totalRemaining: Decimal;
  overspentCount: number;
  categoryProgress: CategoryProgress[];
}

/**
 * Determines the budget status based on percentage of allocation used.
 *
 * @param percentUsed - The ratio of spent to allocated (e.g., 0.95 means 95%).
 * @returns The budget status: 'overspent' if >= 100%, 'warning' if >= 90%, otherwise 'ok'.
 */
function determineBudgetStatus(percentUsedRatio: Decimal): BudgetStatus {
  if (percentUsedRatio.gte(OVERSPENT_THRESHOLD)) {
    return 'overspent';
  }
  if (percentUsedRatio.gte(WARNING_THRESHOLD)) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Calculates budget progress for each category allocation against actual spending.
 *
 * Sums all DEBIT transactions matching each allocation's categoryId to determine
 * actual spending. Computes remaining budget and percentage used, then assigns
 * a status threshold: 'ok' (< 90%), 'warning' (>= 90%), or 'overspent' (>= 100%).
 *
 * @param allocations - Array of budget allocations with categoryId and amount.
 * @param transactions - Array of transactions to measure spending from.
 * @returns Array of CategoryProgress objects, one per allocation.
 */
export function calculateBudgetProgress(
  allocations: BudgetAllocation[],
  transactions: Transaction[],
): CategoryProgress[] {
  return allocations.map((allocation) => {
    const allocated = new Decimal(allocation.amount);

    const spent = transactions
      .filter((tx) => tx.type === TransactionType.DEBIT && tx.categoryId === allocation.categoryId)
      .reduce((sum, tx) => sum.plus(new Decimal(tx.amount)), new Decimal('0'));

    const remaining = allocated.minus(spent);

    const percentUsedRatio = allocated.isZero() ? new Decimal('0') : spent.div(allocated);
    const percentUsed = percentUsedRatio.times(new Decimal('100'));

    const status = determineBudgetStatus(percentUsedRatio);

    return {
      categoryId: allocation.categoryId,
      allocated,
      spent,
      remaining,
      percentUsed,
      status,
    };
  });
}

/**
 * Calculates a full budget summary including totals and overspent count.
 *
 * Delegates to `calculateBudgetProgress` for per-category details, then aggregates
 * totals across all allocations.
 *
 * @param budget - The budget object containing allocations.
 * @param transactions - Array of transactions for the budget period.
 * @returns A BudgetSummary with totals and per-category progress.
 */
export function calculateBudgetSummary(budget: Budget, transactions: Transaction[]): BudgetSummary {
  const allocations = budget.allocations ?? [];
  const categoryProgress = calculateBudgetProgress(allocations, transactions);

  const totalAllocated = categoryProgress.reduce(
    (sum, cp) => sum.plus(cp.allocated),
    new Decimal('0'),
  );

  const totalSpent = categoryProgress.reduce((sum, cp) => sum.plus(cp.spent), new Decimal('0'));

  const totalRemaining = totalAllocated.minus(totalSpent);

  const overspentCount = categoryProgress.filter((cp) => cp.status === 'overspent').length;

  return {
    totalAllocated,
    totalSpent,
    totalRemaining,
    overspentCount,
    categoryProgress,
  };
}
