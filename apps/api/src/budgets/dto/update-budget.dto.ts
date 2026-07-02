import { z } from 'zod';

import { MIN_AMOUNT, MAX_AMOUNT } from '@wardkeep/shared';

export const UpdateBudgetSchema = z.object({
  allocations: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        amount: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .refine((val) => {
            const num = parseFloat(val);
            return num >= MIN_AMOUNT && num <= MAX_AMOUNT;
          }, `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`),
      }),
    )
    .min(1, 'At least one allocation is required'),
});

export type UpdateBudgetDto = z.infer<typeof UpdateBudgetSchema>;
