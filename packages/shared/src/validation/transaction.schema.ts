/**
 * Transaction validation schemas.
 */
import { z } from 'zod';

import { TransactionType } from '../types/transaction';
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_AMOUNT,
  MAX_TAGS_PER_TRANSACTION,
  MERCHANT_MAX_LENGTH,
  MIN_AMOUNT,
  NOTES_MAX_LENGTH,
  TAG_MAX_LENGTH,
} from '../constants/limits';
import { PaginationSchema, SortDirectionSchema, UuidSchema } from './common.schema';

/** Schema for creating a new transaction. */
export const CreateTransactionSchema = z.object({
  accountId: UuidSchema,
  categoryId: UuidSchema.optional(),
  date: z.string().datetime(),
  amount: z
    .string()
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= MIN_AMOUNT && num <= MAX_AMOUNT;
      },
      { message: `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}` },
    ),
  type: z.nativeEnum(TransactionType),
  merchant: z.string().max(MERCHANT_MAX_LENGTH).trim().optional(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).trim().optional(),
  notes: z.string().max(NOTES_MAX_LENGTH).trim().optional(),
  tags: z
    .array(z.string().min(1).max(TAG_MAX_LENGTH).trim())
    .max(MAX_TAGS_PER_TRANSACTION)
    .optional(),
});

/** Schema for updating an existing transaction. */
export const UpdateTransactionSchema = z.object({
  accountId: UuidSchema.optional(),
  categoryId: UuidSchema.nullable().optional(),
  date: z.string().datetime().optional(),
  amount: z
    .string()
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= MIN_AMOUNT && num <= MAX_AMOUNT;
      },
      { message: `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}` },
    )
    .optional(),
  type: z.nativeEnum(TransactionType).optional(),
  merchant: z.string().max(MERCHANT_MAX_LENGTH).trim().nullable().optional(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).trim().nullable().optional(),
  notes: z.string().max(NOTES_MAX_LENGTH).trim().nullable().optional(),
  tags: z
    .array(z.string().min(1).max(TAG_MAX_LENGTH).trim())
    .max(MAX_TAGS_PER_TRANSACTION)
    .optional(),
});

/** Schema for searching/filtering transactions. */
export const TransactionSearchSchema = PaginationSchema.extend({
  accountId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  type: z.nativeEnum(TransactionType).optional(),
  merchant: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  tag: z.string().optional(),
  sortBy: z.enum(['date', 'amount', 'merchant']).default('date'),
  sortDirection: SortDirectionSchema,
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;
export type TransactionSearchInput = z.infer<typeof TransactionSearchSchema>;
