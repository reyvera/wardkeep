---
layout: default
title: Quick Start
nav_order: 2
permalink: /quick-start
---

# Quick Start

{: .fs-9 }

Get Wardkeep running locally for development in 5 minutes.
{: .fs-6 .fw-300 }

---

## Prerequisites

| Requirement      | Version | Notes                                                   |
| :--------------- | :------ | :------------------------------------------------------ |
| Node.js          | v22+    | Use nvm: `nvm install 22 && nvm use 22`                 |
| Docker & Compose | v2+     | For Postgres and Redis                                  |
| pnpm             | 8.15.9  | Auto-installed via corepack from `packageManager` field |

---

## 1. Clone and install

```bash
git clone https://github.com/reyvera/wardkeep.git
cd budgetapp

# Use Node 22
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22

# Install dependencies (pnpm auto-activates via corepack)
pnpm install
```

---

## 2. Start infrastructure

```bash
docker compose up -d postgres redis
```

This starts PostgreSQL 15 and Redis 7 in the background.

---

## 3. Set up the database

```bash
# Apply reviewed migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed default categories
pnpm db:seed
```

If this is an existing development database made by an older Wardkeep build and
Prisma reports missing migration history, do not use `db push`. Back it up, then
run `pnpm db:baseline:local` from the Wardkeep revision that last wrote the database.
The command verifies the schema before recording migration history and does not
change household data.

---

## 4. Start the API

```bash
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
```

{: .note }
The API uses `ts-node --swc` (not plain ts-node or tsx) because NestJS requires `emitDecoratorMetadata` for dependency injection.

---

## 5. Start the frontend

In a separate terminal:

```bash
cd apps/web
pnpm dev
```

---

## 6. Open the app

| Service      | URL                                                                  |
| :----------- | :------------------------------------------------------------------- |
| Web UI       | [http://localhost:3000](http://localhost:3000)                       |
| API          | [http://localhost:4000](http://localhost:4000)                       |
| Health check | [http://localhost:4000/api/health](http://localhost:4000/api/health) |

---

## Demo user (optional)

Seed a demo user with 6 months of realistic sample data:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public" \
npx tsx prisma/seed-demo.ts
```

Login credentials: `demo@wardkeep.app` / `DemoPassword123`

---

## First-time app setup

1. Open [http://localhost:3000](http://localhost:3000) — you'll land on the login page
2. Click **Create account** to register
3. Go to **Bank Connections** to link your bank via SimpleFIN, or **Accounts** to create manual accounts
4. Go to **Settings** to configure AI (set CLOUD mode + paste an OpenAI key for the easiest setup)
5. Use **Chat** to ask questions about your finances
6. Go to **Budget** to set monthly category allocations

---

## AI setup

### Cloud mode (easiest — no local resources)

1. Go to Settings
2. Set AI Privacy Mode to **CLOUD**
3. Paste your OpenAI API key (must start with `sk-`)
4. Save

### Local mode (private — requires 8GB+ RAM)

```bash
docker compose up -d ollama
docker exec -it wardkeep-ollama-1 ollama pull llama3:8b
```

Then set AI Privacy Mode to **LOCAL** in Settings.

---

## Bank connections (SimpleFIN)

1. Create an account at [SimpleFIN Bridge](https://beta-bridge.simplefin.org)
2. Connect your bank through their dashboard
3. Generate a setup token or copy your access URL
4. In app: **Bank Connections** → **Add Connection** → paste the token/URL
5. Hit **Sync** to pull transactions

{: .tip }
For testing without a real bank, use the demo URL: `https://demo:demo@beta-bridge.simplefin.org/simplefin`

---

## Running tests

```bash
# All tests across the monorepo
pnpm turbo test

# Specific package
cd packages/finance-engine && pnpm test
cd packages/importers && pnpm test
cd packages/ai-engine && pnpm test
```

---

## Next steps

- [Self-hosted deployment guide]({{ site.baseurl }}/deployment) — production Docker setup
- [Screenshots]({{ site.baseurl }}/screenshots) — see all the pages
- [Changelog]({{ site.baseurl }}/changelog) — what's new
