# AI Personal Finance App

A private, self-hostable budgeting and finance assistant that helps you track spending, income, debt, savings, bills, subscriptions, and cash flow across all devices.

**The key difference:** instead of only showing numbers, the app explains what is happening, predicts what is coming, and recommends actions.

## Core Principle

AI is never the source of truth. Deterministic math handles balances, forecasts, debt calculations, and budgets. AI explains, categorizes, summarizes, detects patterns, and suggests actions.

## Tech Stack

- **Frontend:** Next.js 14+ / React / TypeScript / Tailwind CSS (PWA)
- **Backend:** NestJS / TypeScript / Prisma ORM
- **Database:** PostgreSQL 15+ (NUMERIC(19,4) for currency)
- **Cache/Queue:** Redis 7+ / BullMQ
- **AI:** Ollama (local LLM) + optional OpenAI/Anthropic cloud APIs
- **Bank Sync:** SimpleFIN (auto-import transactions from linked bank accounts)
- **Deployment:** Docker Compose
- **Monorepo:** Turborepo

## Architecture

```
apps/
├── web/          # Next.js PWA (user-facing UI)
├── api/          # NestJS REST API (business logic, auth, data access)
└── worker/       # BullMQ consumer (background jobs)

packages/
├── shared/           # Types, validation schemas, constants
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
- **Docker Compose** — Single-command self-hosted deployment

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
- **Docker & Docker Compose** (for Postgres and Redis)
- **pnpm 8.15.9** (managed via corepack — auto-installed from `packageManager` field)

### Development Setup

```bash
# 1. Use Node 22 (required by pnpm version)
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22

# 2. Install dependencies
pnpm install

# 3. Start infrastructure
docker compose up -d postgres redis

# 4. Set up database (first time only)
npx prisma db push
npx prisma generate
pnpm db:seed

# 5. Start the API (terminal 1)
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/budgetapp?schema=public" \
REDIS_HOST=localhost REDIS_PORT=6379 PORT=4000 SESSION_TIMEOUT=30 \
ENCRYPTION_KEY=change-me-in-production AI_PRIVACY_MODE=LOCAL \
OLLAMA_URL=http://localhost:11434 \
npx ts-node --project tsconfig.json src/main.ts

# 6. Start the Web frontend (terminal 2)
cd apps/web
pnpm dev
```

### URLs

- **Web UI:** http://localhost:3000
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
# Run all package tests
pnpm turbo test

# Run a specific package's tests
cd packages/finance-engine && pnpm test
cd packages/importers && pnpm test
```

### Self-Hosted Deployment (Production)

```bash
# Clone and configure
git clone <repo-url> && cd budgetapp
cp .env.example .env
# Edit .env — change ENCRYPTION_KEY to a secure random value

# Start everything
docker compose up -d

# App available at http://localhost:3000
# API health check at http://localhost:4000/api/health
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://postgres:postgres@localhost:5432/budgetapp | PostgreSQL connection string |
| `REDIS_HOST` | localhost | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `ENCRYPTION_KEY` | change-me-in-production | AES-256 key for encrypting API keys and bank tokens. **Change in production.** |
| `AI_PRIVACY_MODE` | LOCAL | AI routing: LOCAL, HYBRID, or CLOUD |
| `OLLAMA_URL` | http://localhost:11434 | Ollama endpoint for local AI |
| `SESSION_TIMEOUT` | 30 | Session inactivity timeout in minutes |
| `PORT` | 4000 | API server port |

### Minimum Hardware Requirements

- **Without local AI:** 2 GB RAM, 2 CPU cores, 10 GB storage
- **With local AI (Ollama):** 8 GB RAM, 4 CPU cores, 20 GB storage (model downloads)

## Key Technical Notes

- **Balance display:** Bank-linked accounts show the balance reported by SimpleFIN. Manual accounts compute balance from initial balance + transactions.
- **API dev server:** Uses `ts-node` with SWC (not tsx/esbuild) because NestJS requires `emitDecoratorMetadata` for dependency injection.
- **Database credentials:** The `.env` must use `postgres:postgres` to match docker-compose.
- **Package builds:** All packages emit CommonJS. Packages resolve `@budgetapp/*` from node_modules (compiled dist), not source.
- **Auth:** Middleware redirects unauthenticated users to `/login`. Token stored in localStorage + cookie for SSR middleware access.

## Project Status

MVP feature set is complete and functional. Bank connections, AI chat, accounts, transactions, budgets, and settings all work end-to-end.

Remaining optional work:
- Property-based tests (33 correctness properties defined in design doc)
- Integration tests for critical user journeys
- Recurring transaction detection (worker background job)
- AI auto-categorization batch processing (worker background job)

See `.kiro/specs/ai-personal-finance-app/tasks.md` for the full task breakdown.

## License

TBD
