import { z } from 'zod';

/** Schema for the import commit request body. */
export const CommitImportSchema = z.object({
  fileId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export type CommitImportDto = z.infer<typeof CommitImportSchema>;
