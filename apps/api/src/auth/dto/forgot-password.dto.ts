/**
 * Data transfer object for forgot password request.
 * Validated via Zod ForgotPasswordSchema from @wardkeep/shared.
 */
export interface ForgotPasswordDto {
  email: string;
}
