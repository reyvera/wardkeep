# Dev Environment Setup

inclusion: auto

## Prerequisites

- Node.js v22+ (installed via nvm — required by the pinned pnpm version)
- Docker & Docker Compose v2 (for Postgres and Redis)
- pnpm 8.15.9 (managed via corepack, pinned in package.json `packageManager` field)

## Starting the Dev Environment

```bash
# 1. Source nvm and use Node 22
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22

# 2. Start infrastructure (Postgres 15 + Redis)
docker compose up -d postgres redis

# 3. Start the API (terminal 1) — uses ts-node with SWC for fast startup
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public" \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
PORT=4000 \
SESSION_TIMEOUT=30 \
ENCRYPTION_KEY=dev-testing-key \
AI_PRIVACY_MODE=LOCAL \
OLLAMA_URL=http://localhost:11434 \
npx ts-node --swc --project tsconfig.json src/main.ts

# 4. Start the Web frontend (terminal 2)
cd apps/web
pnpm dev
```

## URLs

- **Web UI:** http://localhost:3000 (redirects to /login if unauthenticated)
- **API:** http://localhost:4000
- **API Health:** http://localhost:4000/api/health
- **Postgres:** localhost:5432 (user: postgres, password: postgres, db: wardkeep)
- **Redis:** localhost:6379

## Database Setup (first time only)

```bash
# Apply schema to database (use db push, not migrate dev — avoids interactive prompts)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed default categories
pnpm db:seed

# Seed demo user with 6 months of sample data (optional)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public" npx tsx prisma/seed-demo.ts
# Login: demo@wardkeep.app / DemoPassword123
```

## Build System

- **API build:** Uses `@swc/cli` (`swc src -d dist --config-file .swcrc`) — compiles TypeScript with decorator metadata support, no type checking. Fast (< 1 second for 86 files).
- **API dev:** Uses `ts-node --swc` — same SWC compilation but on-the-fly, no separate build step.
- **API type check (optional):** `tsc --project tsconfig.json --noEmit` — validates types without emitting. Has some known strict-mode issues with Prisma enum types.
- **Package builds:** All use `tsc --project tsconfig.json` and emit CommonJS to `dist/`.
- **Web build:** `next build` with `output: 'standalone'` in `next.config.js`.
- **Turbo pipeline:** `pnpm turbo build` builds packages in dependency order (shared → finance-engine/ai-engine/importers → api/worker/web).

## AI Setup

AI is configured per-user in the Settings page (http://localhost:3000/settings).

### Cloud Mode (easiest — no local resources needed)
1. Go to Settings
2. Set AI Privacy Mode to **CLOUD**
3. Paste your OpenAI API key (must start with `sk-`)
4. Save

### Local Mode (private — requires 8GB+ RAM)
```bash
docker compose up -d ollama
docker exec -it wardkeep-ollama-1 ollama pull llama3:8b
```
Then set AI Privacy Mode to LOCAL in Settings.

## Bank Connections (SimpleFIN)

The app auto-imports transactions from real banks via SimpleFIN:

1. Create account at https://beta-bridge.simplefin.org
2. Connect your bank through their dashboard
3. Generate a setup token or copy your access URL
4. In app: Bank Connections → Add Connection → paste token/URL
5. Accounts are auto-created and linked
6. Hit Sync to pull transactions

**Demo URL for testing:** `https://demo:demo@beta-bridge.simplefin.org/simplefin`

SimpleFIN tokens are Base64-encoded claim URLs. The app also accepts direct access URLs (with credentials in the URL — these get extracted into Basic Auth headers automatically).

## Balance Display Logic

- **Bank-linked accounts:** Display the balance reported by SimpleFIN (stored in `initialBalance` field, updated on each sync)
- **Manual accounts:** Compute balance from `initialBalance + sum(credits) - sum(debits)`

This applies everywhere: Accounts page, Dashboard net worth, Cash Flow projections, AI Chat context.

## Known Dev Environment Notes

- The API uses `ts-node --swc` (not plain ts-node or tsx) because NestJS requires `emitDecoratorMetadata` for DI, and SWC handles this without full type checking
- ENCRYPTION_KEY must not be `change-me-in-production` in Docker (entrypoint rejects it). Use any other value for dev.
- The `.env` file at the monorepo root must use `postgres:postgres` credentials to match docker-compose
- The shared package (and other packages) must be built as CommonJS (`module: "CommonJS"` in their tsconfigs)
- Package tsconfigs use `"paths": {}` to override base tsconfig paths — packages resolve `@wardkeep/*` from node_modules (compiled dist) not source
- `AuthModule` is `@Global()` so `AuthGuard` can resolve `AuthService` across all modules
- Ollama is optional for dev — AI features degrade gracefully without it
- The frontend uses a Next.js middleware (`apps/web/src/middleware.ts`) that checks for a `token` cookie to protect routes
- Auth token is stored in both localStorage (for API calls) and a cookie (for SSR middleware)
- Node's `fetch` doesn't allow credentials in URLs — SimpleFIN access URLs have credentials extracted into Basic Auth headers
- The worker's tsc output nests the full directory structure due to paths config: `dist/apps/worker/src/main.js`

## Frontend-to-API Field Mapping

Common pattern: the frontend must send field names and enum values exactly as the API Zod schemas expect:

- Account types: `CHECKING`, `SAVINGS`, `CREDIT_CARD`, `LOAN`, `MORTGAGE`, `CASH` (uppercase)
- Transaction types: `CREDIT`, `DEBIT` (not INCOME/EXPENSE)
- AI privacy modes: `LOCAL`, `HYBRID`, `CLOUD` (uppercase)
- Backup schedules: `DAILY`, `WEEKLY`, `MONTHLY` (uppercase)
- Settings keys: `openaiKey`, `anthropicKey` (not openaiApiKey)
- Account creation: `initialBalance` (string), not `balance` (number)
- Chat endpoint: expects `{ query }` not `{ message }`
- Net worth response: returns `{ assets, liabilities, netWorth }` not `total`
- Account list response: returns `currentBalance` not `balance`

## Docker Deployment (from source)

```bash
# Build and start all services (builds images locally)
docker compose up -d --build
```

This uses `docker-compose.yml` which builds from `docker/Dockerfile.*` files. Postgres is v15 in this compose to match dev data volumes.

### Key Docker notes:
- The API and worker Dockerfiles copy the entire pnpm workspace to preserve symlinks, then strip source files
- `NODE_PATH` env var is set in containers to resolve pnpm's hoisted transitive dependencies
- Next.js standalone in a monorepo outputs `server.js` at `apps/web/server.js` (not the root)
- Prisma requires `openssl` in Alpine images
- The API entrypoint runs migrations automatically before starting
- Never mix Postgres 15 and 16 data volumes — they're binary incompatible

## Pre-built Image Deployment

```bash
# Use docker-compose.prod.yml (pulls from ghcr.io/reyvera/wardkeep-*)
docker compose -f docker-compose.prod.yml up -d
```

Images are published to GHCR on every tagged release via GitHub Actions.
