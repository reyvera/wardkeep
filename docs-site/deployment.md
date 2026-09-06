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
mkdir -p scripts
curl -fsSL https://raw.githubusercontent.com/reyvera/wardkeep/main/scripts/verify-postgres-recovery.sh \
  -o scripts/verify-postgres-recovery.sh
chmod 700 scripts/verify-postgres-recovery.sh

# Create .env with secure credentials
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" > .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# Pull and start
docker compose pull
docker compose up -d
```

The app and API health check are available through the web origin: [http://localhost:3000](http://localhost:3000) and [http://localhost:3000/api/health](http://localhost:3000/api/health). The production Compose file intentionally exposes only the web port; it proxies `/api` internally and does not publish database or API ports.

For a public HTTPS deployment, point the reverse proxy at the web port only and
set `CORS_ORIGINS=https://your-wardkeep-domain.example` in `.env` before
starting the stack. The browser continues to use the same `/api` path, so no
separate public API hostname or port is required.

---

## Build from source

```bash
git clone https://github.com/reyvera/wardkeep.git && cd wardkeep
cp .env.example .env
# Edit .env — set ENCRYPTION_KEY to a secure value (openssl rand -hex 32)

docker compose up -d --build
```

The standard stack does not download or start Ollama. Local AI is an optional
profile; enable it only if the household needs private, on-device AI.

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
| `CORS_ORIGINS`      | local port 3000     | Comma-separated browser origins allowed to call the API; set this to the public web domain. |
| `AI_PRIVACY_MODE`   | LOCAL               | AI routing: LOCAL, HYBRID, or CLOUD. LOCAL requires the optional `ai` Compose profile.     |
| `OLLAMA_URL`        | http://ollama:11434 | Ollama endpoint for local AI                                                               |
| `SESSION_TIMEOUT`   | 30                  | Session inactivity timeout in minutes                                                      |
| `PORT`              | 4000                | API server port                                                                            |
| `WEB_PORT`          | 3000                | Host port for web UI                                                                       |
| `DEMO_MODE`         | false               | Set to `true` to bypass ENCRYPTION_KEY safety check                                        |

{: .warning }
The app refuses to start if `ENCRYPTION_KEY` is left as the placeholder value `change-me-in-production` (unless `DEMO_MODE=true`).

---

## Local AI setup (optional)

```bash
# Start Ollama alongside the standard services
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

## Household backup and recovery

Wardkeep keeps encrypted household backups in the durable `backups` Compose volume, mounted to `/data/backups` in the API container. In **Settings**, a household can create a manual backup protected by its own passphrase and restore it from the available-backups list. Restoring permanently replaces that household's current Wardkeep records, so review the selected backup and confirmation carefully.

Optional daily, weekly, or monthly scheduled backups are encrypted with a per-household key protected by the deployment's required `ENCRYPTION_KEY`. They remain recoverable through the same Settings workflow while that deployment and encryption key are retained. Keep a separate database-level backup before infrastructure upgrades or a Postgres major-version migration.

These in-app backups are currently recovery records for the same Wardkeep deployment. Cross-deployment backup export and import is not yet available; use a verified PostgreSQL dump for a migration between deployments.

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
# This creates a custom-format archive, verifies it, restores it into a
# disposable timestamped database, verifies the restored schema, and removes
# only that disposable database. The archive is retained in ./backups.
./scripts/verify-postgres-recovery.sh

docker compose pull
docker compose up -d
```

The drill requires the Wardkeep stack to be running and needs enough local disk
space for one database archive. Its backup files contain household data in
portable PostgreSQL format, so store or delete them according to the household's
backup-retention policy. To use another Compose file or archive directory, set
`WARDKEEP_COMPOSE_FILE` or `WARDKEEP_BACKUP_DIR` before running the command.

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
