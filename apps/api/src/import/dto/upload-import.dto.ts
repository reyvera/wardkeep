import { z } from 'zod';

/** Schema for the import upload request body. */
export const UploadImportSchema = z.object({
  accountId: z.string().uuid(),
  format: z.enum(['csv', 'ofx', 'qfx']),
  content: z.string().min(1, 'File content is required'),
  mapping: z
    .object({
      date: z.string(),
      amount: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
    })
    .optional(),
});

export type UploadImportDto = z.infer<typeof UploadImportSchema>;
