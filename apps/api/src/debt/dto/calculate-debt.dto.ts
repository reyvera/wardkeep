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

/** Schema for calculating a debt consolidation scenario. */
export const ConsolidationSchema = z.object({
  debts: z.array(DebtSchema).min(1),
  newApr: z.string().regex(/^\d+(\.\d+)?$/),
  termMonths: z.number().int().min(1).max(360),
  originationFee: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

/** Schema for calculating velocity banking (HELOC chunking). */
export const VelocityBankingSchema = z.object({
  debts: z.array(DebtSchema).min(1),
  helocLimit: z.string().regex(/^\d+(\.\d+)?$/),
  helocApr: z.string().regex(/^\d+(\.\d+)?$/),
  monthlyDisposableIncome: z.string().regex(/^\d+(\.\d+)?$/),
  chunkAmount: z.string().regex(/^\d+(\.\d+)?$/),
});

/** Schema for calculating minimum-only baseline. */
export const MinimumOnlySchema = z.object({
  debts: z.array(DebtSchema).min(1),
});

export type CalculateDebtDto = z.infer<typeof CalculateDebtSchema>;
export type CompareDebtDto = z.infer<typeof CompareDebtSchema>;
export type ConsolidationDto = z.infer<typeof ConsolidationSchema>;
export type VelocityBankingDto = z.infer<typeof VelocityBankingSchema>;
export type MinimumOnlyDto = z.infer<typeof MinimumOnlySchema>;
