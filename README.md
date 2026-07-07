# Wardkeep

*Guard your ground.*

A private, self-hostable, AI-powered personal finance app that helps you track spending, income, debt, savings, bills, subscriptions, and cash flow across all devices.

**The key difference:** instead of only showing numbers, Wardkeep explains what is happening, predicts what is coming, and recommends actions.

## Core Principle

AI is never the source of truth. Deterministic math handles balances, forecasts, debt calculations, and budgets. AI explains, categorizes, summarizes, detects patterns, and suggests actions.

## Tech Stack

- **Frontend:** Next.js 14 / React 18 / TypeScript / Tailwind CSS (PWA with standalone output)
- **Backend:** NestJS 10 / TypeScript / Prisma 5 ORM / SWC (build)
- **Database:** PostgreSQL 16 (production) / 15 (dev compose) — NUMERIC(19,4) for currency
- **Cache/Queue:** Redis 7 / BullMQ
- **AI:** Ollama (local LLM) + optional OpenAI/Anthropic cloud APIs
- **Bank Sync:** SimpleFIN (auto-import transactions from linked bank accounts)
- **Deployment:** Docker Compose with pre-built images on GHCR
- **Monorepo:** Turborepo + pnpm 8.15.9 workspaces
- **CI/CD:** GitHub Actions (build + test on PR, multi-arch publish on tag)

## Architecture

```
apps/
├── web/          # Next.js PWA (standalone output for Docker)
├── api/          # NestJS REST API (SWC build, ts-node --swc for dev)
└── worker/       # BullMQ consumer (background jobs)

packages/
├── shared/           # Types, validation schemas, constants (CommonJS)
├── finance-engine/   # Pure deterministic math (no I/O, no side effects)
├── ai-engine/        # AI provider abstraction (Ollama, OpenAI, Anthropic)
└── importers/        # File parsers (CSV, OFX, QFX)
```

## Features

- **Bank connections** — Auto-import transactions via SimpleFIN (supports most US banks)
- **Manual accounts** — Checking, savings, credit cards, loans, cash
- **Transaction management** — Search, filter, duplicate detection
- **CSV/OFX/QFX import** — Column mapping and preview before commit
- **Category management** — Sub-categories, merge, auto-categorization
- **Monthly budgets** — Set allocations per category with progress tracking
- **Rules engine** — Automatic categorization based on merchant, amount, description
- **AI chat assistant** — Natural-language finance questions (OpenAI, Anthropic, or local Ollama)
- **AI transaction categorization** — Auto-categorize new transactions
- **Debt payoff calculator** — Snowball, avalanche, custom strategies with what-if mode
- **Cash-flow forecast** — 90-day projections based on recurring transactions
- **Encrypted backups** — AES-256-GCM with user passphrase
- **Progressive Web App** — Offline support, installable on any device
- **Docker Compose** — Single-command self-hosted deployment with pre-built images

## AI Privacy Modes

Configure in Settings (http://localhost:3000/settings):

| Mode | Behavior |
|------|----------|
| LOCAL | All AI via Ollama. Zero external network calls. Requires 8GB+ RAM. |
| HYBRID | Sensitive data stays local. General queries can use cloud. |
| CLOUD | All AI via OpenAI/Anthropic. Requires API key. Fast, no local resources needed. |

## Bank Connections (SimpleFIN)

The app supports auto-importing transactions from real bank accounts via [SimpleFIN](https://simplefin.org):

1. Create an account at [SimpleFIN Bridge](https://beta-bridge.simplefin.org)
2. Connect your bank(s) through their dashboard
3. Generate a setup token (Base64 claim token) or get your access URL
4. In the app: go to **Bank Connections** → **Add Connection** → paste the token/URL
5. Accounts are auto-created and linked. Hit **Sync** to pull transactions.

**For testing:** use the demo access URL `https://demo:demo@beta-bridge.simplefin.org/simplefin`

Bank-linked accounts display the balance reported by your bank directly. Manual accounts compute balance from initial balance + transactions.

## Getting Started

### Prerequisites

- **Node.js v22+** (use nvm: `nvm install 22 && nvm use 22`)
- **Docker & Docker Compose v2** (for Postgres, Redis, and production deployment)
- **pnpm 8.15.9** (managed via corepack — auto-installed from `packageManager` field)

### Development Setup

```bash
# 1. Use Node 22 (required by pnpm version)
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (Postgres 15 + Redis)
docker compose up -d postgres redis

# 4. Set up database (first time only)
npx prisma db push
npx prisma generate
pnpm db:seed

# 5. Start the API (terminal 1) — uses ts-node with SWC for fast startup
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public" \
REDIS_HOST=localhost REDIS_PORT=6379 PORT=4000 SESSION_TIMEOUT=30 \
ENCRYPTION_KEY=dev-testing-key AI_PRIVACY_MODE=LOCAL \
OLLAMA_URL=http://localhost:11434 \
npx ts-node --swc --project tsconfig.json src/main.ts

# 6. Start the Web frontend (terminal 2)
cd apps/web
pnpm dev
```

### Demo User

To seed a demo user with 6 months of sample data:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public" \
npx tsx prisma/seed-demo.ts
```

Login: `demo@wardkeep.app` / `DemoPassword123`

### URLs

- **Web UI:** http://localhost:3000 (redirects to /login if unauthenticated)
- **API:** http://localhost:4000
- **API Health:** http://localhost:4000/api/health

### First-Time App Setup

1. Open http://localhost:3000 → you'll land on the **login page**
2. Click **Create account** to register
3. Go to **Bank Connections** to link your bank via SimpleFIN, OR
4. Go to **Accounts** to manually create accounts
5. Go to **Settings** to configure AI (set CLOUD mode + OpenAI key for easiest setup)
6. Use **Chat** to ask questions about your finances
7. Go to **Budget** to set monthly category allocations

### Running Tests

```bash
# Run all tests across the monorepo
pnpm turbo test

# Run a specific package's tests
cd packages/finance-engine && pnpm test
cd packages/importers && pnpm test
cd packages/ai-engine && pnpm test
```

## Self-Hosted Deployment (Production)

### One-liner install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/reyvera/budgetapp/main/install.sh | bash
```

This downloads the compose file, generates secure credentials, pulls pre-built images from GHCR, and starts the app. Done in under 2 minutes.

### Manual install (from pre-built images)

```bash
# Create a directory and download the compose file
mkdir ~/wardkeep && cd ~/wardkeep
curl -fsSL https://raw.githubusercontent.com/reyvera/budgetapp/main/docker-compose.prod.yml -o docker-compose.yml

# Create .env with your encryption key
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" > .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# Pull and start
docker compose pull
docker compose up -d
```

### Build from source

```bash
# Clone and configure
git clone https://github.com/reyvera/budgetapp.git && cd budgetapp
cp .env.example .env
# Edit .env — set ENCRYPTION_KEY to a secure random value (openssl rand -hex 32)

# Build and start everything
docker compose up -d --build

# App available at http://localhost:3000
# API health check at http://localhost:4000/api/health
```

### Updating

```bash
# Pre-built images
cd ~/wardkeep && docker compose pull && docker compose up -d

# From source
cd wardkeep && git pull && docker compose up -d --build
```

### Local AI setup (optional, requires 8GB+ RAM)

```bash
# Start with the AI profile (prod compose) or just start ollama (dev compose)
docker compose --profile ai up -d    # prod
docker compose up -d ollama           # dev

# Pull a model
docker compose exec ollama ollama pull llama3:8b

# Set AI_PRIVACY_MODE=LOCAL in .env, then restart
docker compose restart api worker
```

### Dockge / Portainer Setup

If you use a Docker management UI like Dockge, create a stack with the contents of `docker-compose.prod.yml` and add a `.env` file with `ENCRYPTION_KEY` and `POSTGRES_PASSWORD`. The images are public on GHCR — no auth required to pull.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | *(required)* | AES-256 key for encrypting API keys and bank tokens. Generate with `openssl rand -hex 32`. App refuses to start with placeholder value. |
| `POSTGRES_PASSWORD` | postgres | PostgreSQL password. Set a unique value in production. |
| `DATABASE_URL` | postgresql://postgres:postgres@localhost:5432/wardkeep | PostgreSQL connection string (auto-constructed in Docker) |
| `REDIS_HOST` | localhost (redis in Docker) | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `AI_PRIVACY_MODE` | LOCAL | AI routing: LOCAL, HYBRID, or CLOUD |
| `OLLAMA_URL` | http://localhost:11434 | Ollama endpoint for local AI |
| `SESSION_TIMEOUT` | 30 | Session inactivity timeout in minutes |
| `PORT` | 4000 | API server port |
| `WEB_PORT` | 3000 | Host port for web UI (prod compose) |
| `API_PORT` | 4000 | Host port for API (prod compose) |
| `DEMO_MODE` | false | Set to `true` to bypass ENCRYPTION_KEY safety check |

### Minimum Hardware Requirements

- **Without local AI:** 2 GB RAM, 2 CPU cores, 10 GB storage
- **With local AI (Ollama):** 8 GB RAM, 4 CPU cores, 20 GB storage (model downloads)

## Key Technical Notes

### Development

- **API dev server:** Uses `ts-node --swc` (not tsx/esbuild) because NestJS requires `emitDecoratorMetadata` for dependency injection. SWC handles decorator compilation without full type-checking.
- **API production build:** Uses `@swc/cli` (`swc src -d dist`) — skips type checking for fast builds. Type checking available separately via `tsc --noEmit`.
- **Package builds:** All packages emit CommonJS (`module: "CommonJS"` in tsconfigs). Package tsconfigs override base paths with `"paths": {}` so they resolve `@wardkeep/*` from node_modules (compiled dist), not source.
- **Database credentials:** Dev compose uses `postgres:postgres`. Production compose uses env vars.
- **Auth:** Token stored in both localStorage (for API calls) and a cookie (for Next.js SSR middleware). Middleware redirects unauthenticated users to `/login`.
- **Balance display:** Bank-linked accounts show balance from SimpleFIN. Manual accounts compute from `initialBalance + sum(credits) - sum(debits)`.

### Docker Deployment

- **pnpm workspace symlinks:** Docker `COPY` doesn't preserve symlinks the way pnpm expects. The API and worker Dockerfiles copy the entire workspace structure from the builder, then remove source files. This preserves the `node_modules/@wardkeep/*` → `packages/*/` symlink chain.
- **NODE_PATH:** Required for pnpm's hoisted dependency resolution. Set to `/app/node_modules/.pnpm/node_modules:/app/apps/{app}/node_modules` so Node can find both hoisted transitive deps (like `express`, `reflect-metadata`) and workspace packages (like `@wardkeep/shared`).
- **Next.js standalone in monorepos:** The standalone output places `server.js` at `apps/web/server.js` (not the root), with static files and public assets relative to that path. The web Dockerfile accounts for this.
- **Worker entry point:** Due to the worker tsconfig's `paths` referencing workspace packages, `tsc` outputs with the full directory structure: `apps/worker/dist/apps/worker/src/main.js`.
- **Prisma in Docker:** Requires `openssl` package in Alpine images. The entrypoint runs `prisma migrate deploy` (or falls back to `prisma db push`) before starting the API.
- **Postgres version:** Dev compose uses postgres:15-alpine. Prod compose uses postgres:16-alpine. Existing data volumes initialized with one version are NOT compatible with the other — you'll see "database files are incompatible" if mismatched.
- **ENCRYPTION_KEY safety:** The API entrypoint refuses to start if `ENCRYPTION_KEY=change-me-in-production` (unless `DEMO_MODE=true`).
- **Image updates:** Always `docker rmi` the old images before pulling, or use `docker compose pull --ignore-pull-failures` — Docker may cache `latest` tags and not re-pull.

## Roadmap

✅ = shipped · 📋 = planned

| Feature | Status |
|---------|--------|
| Bank auto-import (SimpleFIN) | ✅ |
| AI chat assistant (OpenAI/Anthropic/Ollama) | ✅ |
| Dashboard with charts & savings projections | ✅ |
| Monthly budgets with category progress | ✅ |
| Transaction categorization (manual + AI) | ✅ |
| Transfer detection & filtering | ✅ |
| Debt payoff calculator | ✅ |
| Cash-flow 90-day forecast | ✅ |
| Encrypted backups | ✅ |
| PWA / offline support | ✅ |
| Docker self-hosted deployment | ✅ |
| Pre-built images on GHCR | ✅ |
| CI/CD pipeline | ✅ |
| Readiness Engine (household decision engine) | 📋 |
| Capability SDK (extensible domain modules) | 📋 |
| Morning Brief / Advisor | 📋 |
| Multi-currency support | 📋 |

Full task breakdown: [`.kiro/specs/ai-personal-finance-app/tasks.md`](.kiro/specs/ai-personal-finance-app/tasks.md)

## Project Status

v1.0.0 released. Self-hosted deployment verified on Dockge. Bank connections, AI chat, accounts, transactions, budgets, and settings all work end-to-end.

## License

Copyright (C) 2026 Reymundo A Vera

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).
