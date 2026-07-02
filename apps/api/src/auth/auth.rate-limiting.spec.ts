/**
 * Property-based tests for rate limiting logic.
 * Validates: Requirements 17.8, 17.9
 *
 * Tests the logical invariant that a sliding-window rate limiter correctly
 * rejects requests beyond the configured threshold and accepts requests
 * after the window resets.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { RATE_LIMIT_AUTH } from '@wardkeep/shared';

// ─── Rate Limiter Simulation ────────────────────────────────────────────────────

/** Window duration in milliseconds (60 seconds for auth endpoints). */
const WINDOW_MS = 60_000;

interface RateLimiterState {
  /** Timestamps of requests within the current window. */
  requests: number[];
  /** Maximum allowed requests per window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets (provided when rejected). */
  retryAfterMs?: number;
}

/**
 * Creates a new rate limiter state.
 * @param limit - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 */
function createRateLimiter(limit: number, windowMs: number): RateLimiterState {
  return { requests: [], limit, windowMs };
}

/**
 * Attempts a request against the rate limiter at the given timestamp.
 * Prunes expired entries and checks against the limit.
 * @param state - Mutable rate limiter state
 * @param timestampMs - The timestamp of the incoming request
 * @returns Whether the request is allowed and optional retry-after duration
 */
function attemptRequest(state: RateLimiterState, timestampMs: number): RateLimitResult {
  const windowStart = timestampMs - state.windowMs;

  // Prune requests outside the current window
  state.requests = state.requests.filter((ts) => ts > windowStart);

  if (state.requests.length >= state.limit) {
    const oldestInWindow = state.requests[0];
    const retryAfterMs = oldestInWindow + state.windowMs - timestampMs;
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  state.requests.push(timestampMs);
  return { allowed: true };
}

// ─── Property Tests ─────────────────────────────────────────────────────────────

describe('Rate Limiting Logic', () => {
  it(
    'Property 31: Rate limiting rejects requests beyond threshold',
    {
      tags: [
        'Feature: ai-personal-finance-app',
        'Property 31: Rate limiting rejects requests beyond threshold',
      ],
    },
    () => {
      fc.assert(
        fc.property(
          // Generate a number of requests that exceeds the auth rate limit
          fc.integer({ min: RATE_LIMIT_AUTH + 1, max: RATE_LIMIT_AUTH * 5 }),
          // Generate a base timestamp
          fc.integer({ min: 1_000_000, max: 1_000_000_000 }),
          (totalRequests, baseTimestamp) => {
            const limiter = createRateLimiter(RATE_LIMIT_AUTH, WINDOW_MS);

            let acceptedCount = 0;
            let rejectedCount = 0;
            let lastRejectionHadRetryAfter = true;

            // Send all requests within the same window (small increments)
            for (let i = 0; i < totalRequests; i++) {
              // Each request is 1ms apart — all within the 60s window
              const timestamp = baseTimestamp + i;
              const result = attemptRequest(limiter, timestamp);

              if (result.allowed) {
                acceptedCount++;
              } else {
                rejectedCount++;
                // Every rejection must include a non-negative retry-after value
                if (result.retryAfterMs === undefined || result.retryAfterMs < 0) {
                  lastRejectionHadRetryAfter = false;
                }
              }
            }

            // Exactly RATE_LIMIT_AUTH requests should be accepted
            expect(acceptedCount).toBe(RATE_LIMIT_AUTH);

            // All requests beyond the limit should be rejected
            expect(rejectedCount).toBe(totalRequests - RATE_LIMIT_AUTH);

            // All rejections must provide a valid retry-after value
            expect(lastRejectionHadRetryAfter).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 31b: Rate limiting accepts requests after window reset',
    {
      tags: [
        'Feature: ai-personal-finance-app',
        'Property 31: Rate limiting rejects requests beyond threshold',
      ],
    },
    () => {
      fc.assert(
        fc.property(
          // Number of requests in first burst (fill the window)
          fc.constant(RATE_LIMIT_AUTH),
          // Time gap after the window (must exceed WINDOW_MS)
          fc.integer({ min: WINDOW_MS + 1, max: WINDOW_MS * 3 }),
          // Base timestamp
          fc.integer({ min: 1_000_000, max: 1_000_000_000 }),
          (burstSize, gapMs, baseTimestamp) => {
            const limiter = createRateLimiter(RATE_LIMIT_AUTH, WINDOW_MS);

            // Fill the window with exactly RATE_LIMIT_AUTH requests
            for (let i = 0; i < burstSize; i++) {
              const result = attemptRequest(limiter, baseTimestamp + i);
              expect(result.allowed).toBe(true);
            }

            // Verify the next request within the window is rejected
            const rejectedResult = attemptRequest(limiter, baseTimestamp + burstSize);
            expect(rejectedResult.allowed).toBe(false);

            // After the window resets, a new request should be accepted
            const afterWindowTimestamp = baseTimestamp + gapMs;
            const acceptedResult = attemptRequest(limiter, afterWindowTimestamp);
            expect(acceptedResult.allowed).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
