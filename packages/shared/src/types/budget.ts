/**
 * Budget domain types.
 */

/** Budget entity matching Prisma schema. */
export interface Budget {
  id: string;
  userId: string;
  /** Month stored as ISO date string (first day of month). */
  month: Date;
  createdAt: Date;
  updatedAt: Date;
  allocations?: BudgetAllocation[];
}

/** Budget allocation for a specific category. */
export interface BudgetAllocation {
  id: string;
  budgetId: string;
  categoryId: string;
  /** Stored as string for Decimal.js compatibility during serialization. */
  amount: string;
}
