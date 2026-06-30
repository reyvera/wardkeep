/**
 * Data transfer object for user login.
 * Validated via Zod LoginSchema from @budgetapp/shared.
 */
export interface LoginDto {
  email: string;
  password: string;
}
