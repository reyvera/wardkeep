import { z } from 'zod';

/**
 * Zod schema for creating a debt profile linked to an existing account.
 * APR is provided as a percentage (e.g. "19.99") and stored internally as a decimal (0.1999).
 */
export const CreateDebtProfileSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  apr: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'APR must be a valid decimal string (percentage, e.g. "19.99")'),
  minimumPayment: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Minimum payment must be a valid decimal string'),
  priority: z.number().int().min(0).optional(),
});

/**
 * Zod schema for updating a debt profile.
 * All fields are optional — only provided fields are updated.
 */
export const UpdateDebtProfileSchema = z.object({
  apr: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'APR must be a valid decimal string (percentage, e.g. "19.99")')
    .optional(),
  minimumPayment: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Minimum payment must be a valid decimal string')
    .optional(),
  priority: z.number().int().min(0).optional(),
});

export type CreateDebtProfileDto = z.infer<typeof CreateDebtProfileSchema>;
export type UpdateDebtProfileDto = z.infer<typeof UpdateDebtProfileSchema>;

/**
 * Zod schema for saving a payoff plan.
 * Stores the selected accounts, strategy, monthly payment, and computed results.
 */
export const CreatePayoffPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  accountIds: z.array(z.string().uuid()).min(1, 'At least one account must be selected'),
  strategy: z.enum(['snowball', 'avalanche', 'custom']),
  totalMonthlyPayment: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Total monthly payment must be a valid decimal string'),
  totalInterest: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Total interest must be a valid decimal string'),
  totalMonths: z.number().int().min(0),
});

export type CreatePayoffPlanDto = z.infer<typeof CreatePayoffPlanSchema>;
