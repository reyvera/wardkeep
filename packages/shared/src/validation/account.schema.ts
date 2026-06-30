/**
 * Account validation schemas.
 */
import { z } from 'zod';

import { AccountType } from '../types/account';
import { ACCOUNT_NAME_MAX_LENGTH, MAX_AMOUNT } from '../constants/limits';

/** Schema for creating a new account. */
export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH).trim(),
  type: z.nativeEnum(AccountType),
  currency: z.string().length(3).default('USD'),
  initialBalance: z
    .string()
    .refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= -MAX_AMOUNT && num <= MAX_AMOUNT;
      },
      { message: `Initial balance must be between -${MAX_AMOUNT} and ${MAX_AMOUNT}` },
    ),
});

/** Schema for updating an existing account. */
export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(ACCOUNT_NAME_MAX_LENGTH).trim().optional(),
  type: z.nativeEnum(AccountType).optional(),
  currency: z.string().length(3).optional(),
  isArchived: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
