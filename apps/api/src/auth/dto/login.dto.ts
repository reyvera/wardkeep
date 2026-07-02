/**
 * Data transfer object for user login.
 * Validated via Zod LoginSchema from @wardkeep/shared.
 */
export interface LoginDto {
  email: string;
  password: string;
}
