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

## MVP Features

- Manual accounts (checking, savings, credit cards, loans, cash)
- Transaction management with search, filter, and duplicate detection
- CSV/OFX/QFX import with column mapping and preview
- Category management with sub-categories
- Monthly budgets with threshold alerts
- Rules engine for automatic categorization
- AI transaction categorization (local or cloud)
- AI chat assistant for natural-language finance questions
- Debt payoff calculator (snowball, avalanche, custom)
- Cash-flow forecast (90-day projections)
- Encrypted backups (AES-256-GCM)
- Progressive Web App (offline support, installable)
- Docker Compose self-hosted deployment

## AI Privacy Modes

| Mode | Behavior |
|------|----------|
| Local | All AI via Ollama. Zero external network calls. |
| Hybrid | Sensitive data stays local. General queries can use cloud. |
| Cloud | All AI via external API. Requires explicit user consent. |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- pnpm 8+ (package manager)

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Ollama)
docker compose up -d postgres redis ollama

# Run database migrations
pnpm prisma migrate dev

# Seed default categories
pnpm prisma db seed

# Start all apps in development
pnpm turbo dev
```

Services will be available at:
- Web UI: http://localhost:3000
- API: http://localhost:4000
- Ollama: http://localhost:11434

### Running Tests

```bash
# Run all package tests
pnpm turbo test

# Run a specific package's tests
cd packages/finance-engine && pnpm test
cd packages/importers && pnpm test
cd packages/ai-engine && pnpm test
```

### Self-Hosted Deployment

```bash
# Clone the repo
git clone <repo-url> && cd budgetapp

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum, change ENCRYPTION_KEY to a secure random value

# Start the full stack
docker compose up -d

# The app will be available at http://localhost:3000
# API health check at http://localhost:4000/api/health
```

The API service automatically runs database migrations and seeds default data on first startup.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://...localhost | PostgreSQL connection string |
| `REDIS_HOST` | localhost | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `ENCRYPTION_KEY` | (dev default) | AES-256 key for encrypting API keys and sensitive data. **Change in production.** |
| `AI_PRIVACY_MODE` | LOCAL | AI routing: LOCAL, HYBRID, or CLOUD |
| `OLLAMA_URL` | http://localhost:11434 | Ollama endpoint for local AI |
| `SESSION_TIMEOUT` | 30 | Session inactivity timeout in minutes |
| `PORT` | 4000 | API server port |

### Minimum Hardware Requirements

- **Without local AI:** 2 GB RAM, 2 CPU cores, 10 GB storage
- **With local AI (Ollama):** 8 GB RAM, 4 CPU cores, 20 GB storage (model downloads)

## Project Status

Implementation is complete for the MVP feature set. Remaining work includes optional property-based tests (33 correctness properties defined in the design doc) and manual frontend verification across viewport sizes.

See `.kiro/specs/ai-personal-finance-app/tasks.md` for the full task breakdown and completion status.

## License

TBD
