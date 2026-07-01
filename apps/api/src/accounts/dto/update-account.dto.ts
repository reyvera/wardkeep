import { z } from 'zod';

import { AccountType, ACCOUNT_NAME_MAX_LENGTH } from '@budgetapp/shared';

/**
 * Zod schema for updating an existing account.
 * All fields are optional — only provided fields are updated.
 */
export const UpdateAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(ACCOUNT_NAME_MAX_LENGTH, `Account name must be at most ${ACCOUNT_NAME_MAX_LENGTH} characters`)
    .optional(),
  type: z
    .nativeEnum(AccountType, {
      errorMap: () => ({ message: 'Invalid account type' }),
    })
    .optional(),
  currency: z
    .string()
    .length(3, 'Currency must be exactly 3 characters')
    .optional(),
  initialBalance: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'Initial balance must be a valid decimal string')
    .optional(),
});

export type UpdateAccountDto = z.infer<typeof UpdateAccountSchema>;
