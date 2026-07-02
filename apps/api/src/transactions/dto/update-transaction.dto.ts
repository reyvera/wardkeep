import { z } from 'zod';

import {
  TransactionType,
  MIN_AMOUNT,
  MAX_AMOUNT,
  TAG_MAX_LENGTH,
  MAX_TAGS_PER_TRANSACTION,
  MERCHANT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from '@wardkeep/shared';

/**
 * Zod schema for updating an existing transaction.
 * All fields are optional — only provided fields are updated.
 */
export const UpdateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive decimal string')
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= MIN_AMOUNT && num <= MAX_AMOUNT;
      },
      `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`,
    )
    .optional(),
  type: z
    .nativeEnum(TransactionType, {
      errorMap: () => ({ message: 'Invalid transaction type' }),
    })
    .optional(),
  categoryId: z.string().uuid().optional().nullable(),
  merchant: z.string().min(1).max(MERCHANT_MAX_LENGTH).optional().nullable(),
  description: z.string().min(1).max(DESCRIPTION_MAX_LENGTH).optional().nullable(),
  notes: z.string().min(1).max(NOTES_MAX_LENGTH).optional().nullable(),
  tags: z
    .array(z.string().min(1).max(TAG_MAX_LENGTH))
    .max(MAX_TAGS_PER_TRANSACTION)
    .optional(),
});

export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>;
