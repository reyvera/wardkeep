/**
 * Property-based tests for authentication schema validation.
 * Validates: Requirements 1.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { RegisterSchema } from './auth.schema';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/limits';

/**
 * Extract the password field schema from RegisterSchema for isolated testing.
 * We parse with a valid email and matching confirmPassword so only password validation is tested.
 */
function validatePassword(password: string): boolean {
  const result = RegisterSchema.safeParse({
    email: 'test@example.com',
    password,
    confirmPassword: password,
  });
  return result.success;
}

describe('Password validation', () => {
  it(
    'Property 33: Password validation enforces length constraints',
    { tags: ['Feature: ai-personal-finance-app', 'Property 33: Password validation enforces length constraints'] },
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (password) => {
            const isValid = validatePassword(password);
            const length = password.length;

            if (length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH) {
              expect(isValid).toBe(true);
            } else {
              expect(isValid).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
