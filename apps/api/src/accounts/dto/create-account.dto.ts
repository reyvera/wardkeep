import { z } from 'zod';

import { AccountType, ACCOUNT_NAME_MAX_LENGTH } from '@budgetapp/shared';

/**
 * Zod schema for creating a new account.
 * Validates name, type, currency, and initialBalance fields.
 */
export const CreateAccountSchema = z.object({
  name: z
    .string()
    .min(1, 'Account name is required')
    .max(ACCOUNT_NAME_MAX_LENGTH, `Account name must be at most ${ACCOUNT_NAME_MAX_LENGTH} characters`),
  type: z.nativeEnum(AccountType, {
    errorMap: () => ({ message: 'Invalid account type' }),
  }),
  currency: z
    .string()
    .length(3, 'Currency must be exactly 3 characters')
    .default('USD'),
  initialBalance: z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'Initial balance must be a valid decimal string'),
});

export type CreateAccountDto = z.infer<typeof CreateAccountSchema>;
