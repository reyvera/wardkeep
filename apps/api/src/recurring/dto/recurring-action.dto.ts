import { z } from 'zod';

/** Schema for recurring transaction actions (confirm, dismiss, deactivate). */
export const RecurringActionSchema = z.object({
  id: z.string().uuid(),
});

export type RecurringActionDto = z.infer<typeof RecurringActionSchema>;
