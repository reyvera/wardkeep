import { z } from 'zod';

const DebtSchema = z.object({
  id: z.string(),
  name: z.string(),
  balance: z.string().regex(/^\d+(\.\d+)?$/),
  apr: z.string().regex(/^\d+(\.\d+)?$/),
  minimumPayment: z.string().regex(/^\d+(\.\d+)?$/),
  priority: z.number().int().positive().optional(),
});

/** Schema for calculating a debt payoff schedule. */
export const CalculateDebtSchema = z.object({
  debts: z.array(DebtSchema).min(1),
  strategy: z.enum(['snowball', 'avalanche', 'custom']),
  totalMonthlyPayment: z.string().regex(/^\d+(\.\d+)?$/),
});

/** Schema for comparing multiple strategies. */
export const CompareDebtSchema = z.object({
  debts: z.array(DebtSchema).min(1),
  strategies: z.array(z.enum(['snowball', 'avalanche', 'custom'])).min(2),
  totalMonthlyPayment: z.string().regex(/^\d+(\.\d+)?$/),
});

export type CalculateDebtDto = z.infer<typeof CalculateDebtSchema>;
export type CompareDebtDto = z.infer<typeof CompareDebtSchema>;
