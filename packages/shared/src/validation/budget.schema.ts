/**
 * Budget validation schemas.
 */
import { z } from 'zod';

import { MAX_AMOUNT, MIN_AMOUNT } from '../constants/limits';
import { UuidSchema } from './common.schema';

/** Single budget allocation entry. */
const BudgetAllocationSchema = z.object({
  categoryId: UuidSchema,
  amount: z
    .string()
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= MIN_AMOUNT && num <= MAX_AMOUNT;
      },
      { message: `Allocation amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}` },
    ),
});

/** Schema for creating a new budget. */
export const CreateBudgetSchema = z.object({
  /** Month in YYYY-MM-DD format (first day of month). */
  month: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    { message: 'Month must be in YYYY-MM-DD format' },
  ),
  allocations: z.array(BudgetAllocationSchema).min(1),
});

/** Schema for updating an existing budget. */
export const UpdateBudgetSchema = z.object({
  allocations: z.array(BudgetAllocationSchema).min(1),
});

/** Schema for copying a budget from one month to another. */
export const CopyBudgetSchema = z.object({
  sourceMonth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    { message: 'Source month must be in YYYY-MM-DD format' },
  ),
  targetMonth: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    { message: 'Target month must be in YYYY-MM-DD format' },
  ),
}).refine(
  (data) => data.sourceMonth !== data.targetMonth,
  { message: 'Source and target months must be different' },
);

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
export type CopyBudgetInput = z.infer<typeof CopyBudgetSchema>;
