# Architecture Guidelines

inclusion: auto

## Core Principle

**AI is never the source of truth.** The Finance Engine (deterministic math) handles all calculations — balances, forecasts, debt schedules, budgets. The AI Engine explains, categorizes, summarizes, detects patterns, and suggests actions. When AI produces numerical claims, the Finance Engine independently verifies them.

## Monorepo Structure

```
apps/web        → Next.js PWA (user-facing UI)
apps/api        → NestJS REST API (business logic, auth, data access)
apps/worker     → BullMQ consumer (background jobs)
packages/shared → Types, validation, constants (used by all)
packages/finance-engine → Pure deterministic math (no I/O, no side effects)
packages/ai-engine      → AI provider abstraction (Ollama, OpenAI, Anthropic)
packages/importers      → File parsers (CSV, OFX, QFX)
```

## Package Dependency Rules

- `packages/shared` → no internal dependencies (leaf package)
- `packages/finance-engine` → depends only on `shared` and `decimal.js`
- `packages/ai-engine` → depends only on `shared`
- `packages/importers` → depends only on `shared`
- `apps/api` → may depend on all packages
- `apps/worker` → may depend on all packages
- `apps/web` → depends on `shared` only (calls API for everything else)

Never create circular dependencies between packages.

## Data Flow Patterns

- **Synchronous:** PWA → API → Finance Engine → PostgreSQL → Response
- **Async:** API → Redis (BullMQ) → Worker → AI Engine / Finance Engine → DB → Notification
- **AI-verified:** API → AI Engine → Finance Engine (verify) → Corrected Response

## Currency and Math

- ALL financial values use `Decimal.js` — never native `number` for money
- PostgreSQL stores currency as `NUMERIC(19,4)`
- Intermediate interest calculations: minimum 10 decimal places
- Display values: 2 decimal places for currency
- Comparison: use `.eq()`, `.gt()`, `.lt()` — never `===` on Decimals

## Error Handling

- NestJS exception filters for consistent API error responses
- Throw domain-specific exceptions (`AccountNotFoundException`, `BudgetOverflowException`)
- All errors include: statusCode, error type, human message, optional field-level details
- AI service unavailability must never block non-AI features (circuit breaker pattern)
- Database operations on financial data use SERIALIZABLE isolation level

## Security Patterns

- Per-user data isolation enforced at the service/repository layer (userId in every query)
- Sensitive fields encrypted at application layer (AES-256) before storage
- Encryption keys in environment variables, never in DB or code
- Rate limiting at the API gateway level (NestJS throttler)
- Audit log for all security-relevant events (append-only, 90-day retention)

## Background Processing

- Use BullMQ queues for: AI categorization, import processing, recurring detection, backups, notifications
- Worker runs as separate NestJS standalone app consuming queue jobs
- Jobs should be idempotent (safe to retry on failure)
- Graceful shutdown: complete in-progress jobs before exit

## Frontend Patterns

- React Query for server state (API data)
- Zustand for client-only state (UI preferences, offline queue)
- Service worker handles offline caching and action queuing
- All API calls go through a typed client generated from shared types
- Components are server components by default; add `'use client'` only when needed

## Docker Deployment Architecture

- **Three container images:** api, web, worker — each built from `docker/Dockerfile.*`
- **API + Worker:** Copy full pnpm workspace structure to preserve symlinks. Set `NODE_PATH` for hoisted dep resolution. Strip source files in runner stage.
- **Web:** Uses Next.js `output: 'standalone'` — minimal server with embedded deps. In monorepos, standalone outputs at `apps/web/server.js` (not root).
- **Build tool:** API uses SWC (`@swc/cli`) for production builds — fast, no type checking. Packages use tsc.
- **Entry points:** API at `apps/api/dist/main.js`, Worker at `apps/worker/dist/apps/worker/src/main.js` (nested due to tsconfig paths), Web at `apps/web/server.js`.
- **Startup:** API entrypoint runs `prisma migrate deploy` before starting. Refuses default ENCRYPTION_KEY.
- **CI/CD:** GitHub Actions builds and pushes images to GHCR on tag push. amd64 only (arm64 QEMU too slow on free runners).
- **Compose variants:** `docker-compose.yml` (build from source, postgres:15), `docker-compose.prod.yml` (pre-built GHCR images, postgres:16), `docker-compose.demo.yml` (lightweight, no AI/worker).
