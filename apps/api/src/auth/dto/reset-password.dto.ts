/**
 * Data transfer object for password reset.
 * Validated via Zod ResetPasswordSchema from @wardkeep/shared.
 */
export interface ResetPasswordDto {
  token: string;
  password: string;
  confirmPassword: string;
}
