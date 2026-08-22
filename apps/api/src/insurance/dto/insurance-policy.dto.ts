import { z } from 'zod';

const policyTypes = ['AUTO', 'HOME', 'RENTERS', 'HEALTH', 'LIFE', 'DISABILITY', 'UMBRELLA', 'OTHER'] as const;
const premiumFrequencies = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;
const money = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid positive decimal amount');

export const CreateInsurancePolicySchema = z.object({
  type: z.enum(policyTypes),
  provider: z.string().trim().min(1, 'Provider is required').max(160),
  nickname: z.string().trim().max(100).optional(),
  premium: money.optional(),
  premiumFrequency: z.enum(premiumFrequencies).optional(),
  deductible: money.optional(),
  coverageAmount: money.optional(),
  renewalDate: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const UpdateInsurancePolicySchema = CreateInsurancePolicySchema.partial().extend({
  isActive: z.boolean().optional(),
  nickname: z.string().trim().max(100).nullable().optional(),
  premium: money.nullable().optional(),
  deductible: money.nullable().optional(),
  coverageAmount: money.nullable().optional(),
  renewalDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateInsurancePolicyDto = z.infer<typeof CreateInsurancePolicySchema>;
export type UpdateInsurancePolicyDto = z.infer<typeof UpdateInsurancePolicySchema>;
