/**
 * Data transfer object for forgot password request.
 * Validated via Zod ForgotPasswordSchema from @budgetapp/shared.
 */
export interface ForgotPasswordDto {
  email: string;
}
