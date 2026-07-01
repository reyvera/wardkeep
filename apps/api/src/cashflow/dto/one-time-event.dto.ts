import { z } from 'zod';

/** Schema for adding a one-time cash-flow event. */
export const OneTimeEventSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().datetime(),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string'),
  type: z.enum(['credit', 'debit']),
  description: z.string().min(1).max(200),
});

export type OneTimeEventDto = z.infer<typeof OneTimeEventSchema>;
