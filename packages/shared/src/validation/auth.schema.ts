/**
 * Authentication and authorization validation schemas.
 */
import { z } from 'zod';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/limits';

/** Email validation reusable schema. */
const EmailSchema = z.string().email().max(255).trim().toLowerCase();

/** Password validation reusable schema. */
const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  .max(PASSWORD_MAX_LENGTH);

/** Schema for user registration. */
export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] },
);

/** Schema for user login. */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});

/** Schema for forgot password request. */
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

/** Schema for password reset. */
export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] },
);

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
