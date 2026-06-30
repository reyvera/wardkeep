/**
 * Data transfer object for user registration.
 * Validated via Zod RegisterSchema from @budgetapp/shared.
 */
export interface RegisterDto {
  email: string;
  password: string;
  confirmPassword: string;
}
