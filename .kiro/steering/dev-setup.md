# Dev Environment Setup

inclusion: auto

## Prerequisites

- Node.js v22+ (installed via nvm)
- Docker & Docker Compose (for Postgres and Redis)
- pnpm 8.15.9 (managed via corepack, pinned in package.json `packageManager` field)

## Starting the Dev Environment

```bash
# 1. Source nvm and use Node 22
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 3. Start the API (terminal 1)
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/budgetapp?schema=public" \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
PORT=4000 \
SESSION_TIMEOUT=30 \
ENCRYPTION_KEY=change-me-in-production \
AI_PRIVACY_MODE=LOCAL \
OLLAMA_URL=http://localhost:11434 \
npx ts-node --project tsconfig.json src/main.ts

# 4. Start the Web frontend (terminal 2)
cd apps/web
pnpm dev
```

## URLs

- **Web UI:** http://localhost:3000
- **API:** http://localhost:4000
- **API Health:** http://localhost:4000/api/health
- **Postgres:** localhost:5432 (user: postgres, password: postgres, db: budgetapp)
- **Redis:** localhost:6379

## Database Setup (first time only)

```bash
# Apply schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed default categories
pnpm db:seed
```

## Known Dev Environment Notes

- The API uses `ts-node` with SWC (not tsx/esbuild) because NestJS requires `emitDecoratorMetadata` for DI
- The `.env` file at the monorepo root must use `postgres:postgres` credentials to match docker-compose
- The shared package (and other packages) must be built as CommonJS (`module: "CommonJS"` in their tsconfigs)
- Package tsconfigs use `"paths": {}` to override base tsconfig paths — packages resolve `@budgetapp/*` from node_modules (compiled dist) not source
- `AuthModule` is `@Global()` so `AuthGuard` can resolve `AuthService` across all modules
- Ollama is optional for dev — AI features degrade gracefully without it

## Full Production Deployment

```bash
docker compose up -d
```

This builds all images, runs migrations on startup, and starts the full stack (web, api, worker, postgres, redis, ollama).
