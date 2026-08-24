---
layout: default
title: Self-Hosting
nav_order: 3
permalink: /deployment
---

# Self-Hosted Deployment

{: .fs-9 }

Run Wardkeep on your own hardware with Docker Compose.
{: .fs-6 .fw-300 }

---

## One-liner install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/reyvera/wardkeep/main/install.sh | bash
```

This downloads the compose file, generates secure credentials, pulls pre-built images from GHCR, and starts the app. Done in under 2 minutes.

---

## Manual install (pre-built images)

```bash
# Create a directory and download the compose file
mkdir ~/wardkeep && cd ~/wardkeep
curl -fsSL https://raw.githubusercontent.com/reyvera/wardkeep/main/docker-compose.prod.yml \
  -o docker-compose.yml

# Create .env with secure credentials
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" > .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# Pull and start
docker compose pull
docker compose up -d
```

The app is available at [http://localhost:3000](http://localhost:3000). API health check at [http://localhost:4000/api/health](http://localhost:4000/api/health).

---

## Build from source

```bash
git clone https://github.com/reyvera/wardkeep.git && cd wardkeep
cp .env.example .env
# Edit .env — set ENCRYPTION_KEY to a secure value (openssl rand -hex 32)

docker compose up -d --build
```

---

## Updating

```bash
# Pre-built images
cd ~/wardkeep && docker compose pull && docker compose up -d

# From source
cd wardkeep && git pull && docker compose up -d --build
```

---

## Hardware requirements

| Setup                  | RAM  | CPU     | Storage |
| :--------------------- | :--- | :------ | :------ |
| Without local AI       | 2 GB | 2 cores | 10 GB   |
| With local AI (Ollama) | 8 GB | 4 cores | 20 GB   |

---

## Environment variables

| Variable            | Default             | Description                                                                                |
| :------------------ | :------------------ | :----------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY`    | _(required)_        | AES-256 key for encrypting API keys and bank tokens. Generate with `openssl rand -hex 32`. |
| `POSTGRES_PASSWORD` | postgres            | PostgreSQL password. Set a unique value in production.                                     |
| `DATABASE_URL`      | auto-constructed    | PostgreSQL connection string                                                               |
| `REDIS_HOST`        | redis               | Redis hostname                                                                             |
| `REDIS_PORT`        | 6379                | Redis port                                                                                 |
| `AI_PRIVACY_MODE`   | LOCAL               | AI routing: LOCAL, HYBRID, or CLOUD                                                        |
| `OLLAMA_URL`        | http://ollama:11434 | Ollama endpoint for local AI                                                               |
| `SESSION_TIMEOUT`   | 30                  | Session inactivity timeout in minutes                                                      |
| `PORT`              | 4000                | API server port                                                                            |
| `WEB_PORT`          | 3000                | Host port for web UI                                                                       |
| `API_PORT`          | 4000                | Host port for API                                                                          |
| `DEMO_MODE`         | false               | Set to `true` to bypass ENCRYPTION_KEY safety check                                        |

{: .warning }
The app refuses to start if `ENCRYPTION_KEY` is left as the placeholder value `change-me-in-production` (unless `DEMO_MODE=true`).

---

## Local AI setup (optional)

```bash
# Start Ollama alongside other services
docker compose --profile ai up -d

# Pull a model (requires 8GB+ RAM)
docker compose exec ollama ollama pull llama3:8b

# Set AI_PRIVACY_MODE=LOCAL in .env, then restart
docker compose restart api worker
```

{: .note }
AI features degrade gracefully if Ollama is unavailable. Non-AI features are never affected.

---

## Dockge / Portainer

If you use a Docker management UI:

1. Create a stack with the contents of `docker-compose.prod.yml`
2. Add a `.env` file with `ENCRYPTION_KEY` and `POSTGRES_PASSWORD`
3. Images are public on GHCR — no auth required to pull

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web (3000)│     │   API (4000)│     │   Worker    │
│   Next.js   │────▶│   NestJS    │────▶│   BullMQ    │
│  standalone │     │   + Prisma  │     │  consumers  │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                    ┌──────▼──────┐      ┌──────▼──────┐
                    │  PostgreSQL │      │    Redis    │
                    │    (5432)   │      │   (6379)    │
                    └─────────────┘      └─────────────┘

                    ┌─────────────┐
                    │   Ollama    │  (optional)
                    │  (11434)    │
                    └─────────────┘
```

Three container images built from the repo:

- **wardkeep-api** — NestJS REST API with Prisma. Runs migrations on startup.
- **wardkeep-web** — Next.js standalone server.
- **wardkeep-worker** — BullMQ consumer for background jobs (AI categorization, imports, backups, and the daily 03:00 UTC readiness snapshot). Its trusted local API credential is derived from the same required `ENCRYPTION_KEY`; no extra environment variable is needed.

---

## Docker technical notes

- **pnpm workspace symlinks:** Dockerfiles copy the entire workspace structure to preserve `node_modules/@wardkeep/*` symlinks, then strip source files in the runner stage.
- **NODE_PATH:** Set in containers for pnpm's hoisted dependency resolution.
- **Next.js standalone:** In monorepos, standalone outputs at `apps/web/server.js` (not root).
- **Prisma in Alpine:** Requires `openssl` package. Entrypoint runs only checked-in `prisma migrate deploy` migrations before starting. It never falls back to `db push`, accepts data loss, or seeds demo data.
- **Postgres versions:** Dev compose uses postgres:15, prod uses postgres:16. Data volumes are NOT compatible between versions.

---

## Compose variants

| File                      | Use case                              |
| :------------------------ | :------------------------------------ |
| `docker-compose.yml`      | Build from source (dev). Postgres 15. |
| `docker-compose.prod.yml` | Pre-built GHCR images. Postgres 16.   |
| `docker-compose.demo.yml` | Lightweight demo. No AI/worker.       |

---

## Troubleshooting

### App won't start — ENCRYPTION_KEY error

The API rejects the default placeholder key. Generate a real one:

```bash
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
docker compose restart api
```

### Database incompatibility error

You can't attach a Postgres 15 data volume directly to a Postgres 16 container.
Do not run `docker compose down -v`: that deletes the data volume. Keep the
Postgres major version unchanged, or use PostgreSQL's documented dump/restore
upgrade process after taking a verified backup.

### Safe Wardkeep image upgrade

Before changing an image tag, create a database backup. The API only applies
forward, checked-in migrations and stops if one fails; it will not make an
unreviewed schema change to get itself running.

```bash
docker compose exec -T postgres pg_dump -U postgres wardkeep > wardkeep-backup.sql
docker compose pull
docker compose up -d
```

Switching back to an older Wardkeep image does not remove newer columns or
household data. Test `:develop` images against a separate, restored copy of the
database—not the live household stack.

If a database made by a prior development build has no Prisma migration
history, set `WARDKEEP_BASELINE_EXISTING_DATABASE=true` on the API for one
deployment only. It records migration history only after verifying the database
schema exactly matches that image. Remove the variable after the API starts. If
the check reports any difference, stop and use the Wardkeep revision that last
wrote the database to baseline it first.

### Images not updating

Docker may cache `latest` tags. Force a fresh pull:

```bash
docker compose pull --ignore-pull-failures
docker compose up -d --force-recreate
```
