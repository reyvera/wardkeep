# Testing Guidelines

inclusion: auto

## Philosophy

- Every module should have tests before being considered complete.
- Property-based tests for universal invariants (finance-engine, importers, rules).
- Example-based tests for specific edge cases and integration flows.
- Tests are not optional — they're how we verify correctness.

## Frameworks

- **Unit/Integration:** Vitest
- **Property-based:** fast-check (via Vitest)
- **E2E:** Playwright
- **Database testing:** Testcontainers (PostgreSQL, Redis)
- **API testing:** Supertest

## Property-Based Testing (PBT)

- Minimum 100 iterations per property
- Tag format: `Feature: ai-personal-finance-app, Property {N}: {text}`
- Each property test references its design document property number
- Generators should cover edge cases: zero amounts, max amounts, empty collections, boundary dates
- Use `fc.pre()` for preconditions rather than filtering

## Test File Naming

- Unit tests: `*.spec.ts` co-located with source
- Integration tests: `*.integration.spec.ts` in `__tests__/` directory
- E2E tests: `*.e2e.spec.ts` in `apps/web/e2e/`

## What to Test

- **finance-engine:** Pure functions — test all math. No mocking needed.
- **api services:** Test with mocked repositories for unit, real DB for integration.
- **controllers:** Test HTTP layer (validation, status codes, error formats) with Supertest.
- **ai-engine:** Mock LLM responses for deterministic tests. Test routing logic, confidence thresholds.
- **importers:** Test with sample fixture files in `__fixtures__/` directory.
- **frontend:** Test critical user flows with Playwright. Test hooks with React Testing Library.

## Assertions

- Use exact Decimal comparisons for currency (never `toBeCloseTo`)
- Assert error messages and field-level validation details
- Assert response shapes match shared DTOs

## Coverage

- Aim for 80%+ line coverage on packages/finance-engine and packages/importers
- Focus on behavior coverage, not line-chasing, for API and frontend
