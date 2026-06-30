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

- Node.js 20+
- Docker & Docker Compose
- pnpm (package manager)

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Ollama)
docker compose up -d postgres redis ollama

# Run database migrations
pnpm prisma migrate dev

# Start all apps in development
pnpm turbo dev
```

### Self-Hosted Deployment

```bash
# Clone the repo
git clone <repo-url> && cd budgetapp

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start the full stack
docker compose up -d

# The app will be available at http://localhost:3000
```

### Minimum Hardware Requirements

- 2 GB RAM
- 2 CPU cores
- 10 GB storage

## Project Status

This project is under active development following a structured spec at `.kiro/specs/ai-personal-finance-app/`.

## License

TBD
