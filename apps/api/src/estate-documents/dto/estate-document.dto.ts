import { z } from 'zod';

const documentTypes = [
  'WILL',
  'TRUST',
  'FINANCIAL_POWER_OF_ATTORNEY',
  'HEALTHCARE_DIRECTIVE',
  'BENEFICIARY_REVIEW',
  'OTHER',
] as const;

export const CreateEstateDocumentSchema = z.object({
  type: z.enum(documentTypes),
  title: z.string().trim().min(1).max(100).optional(),
  reviewDate: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const UpdateEstateDocumentSchema = CreateEstateDocumentSchema.partial().extend({
  title: z.string().trim().min(1).max(100).nullable().optional(),
  reviewDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateEstateDocumentDto = z.infer<typeof CreateEstateDocumentSchema>;
export type UpdateEstateDocumentDto = z.infer<typeof UpdateEstateDocumentSchema>;
