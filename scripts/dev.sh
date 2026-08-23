#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Wardkeep Local Development
# ─────────────────────────────────────────────────────────────────────────────
# Starts infrastructure (Postgres + Redis) via Docker, then runs the API
# and web frontend with hot-reload.
#
# Usage:
#   pnpm dev              # Start everything
#   pnpm dev:stop         # Stop infrastructure
#   pnpm dev:reset        # Nuke DB and reseed
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure common binary paths are available
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# ─── Detect docker compose command ───────────────────────────────────────────

if docker compose version &> /dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &> /dev/null; then
  DC="docker-compose"
else
  echo "[wardkeep] ERROR: Neither 'docker compose' nor 'docker-compose' found."
  echo "           Install Docker Desktop: https://docker.com/get-started"
  exit 1
fi

COMPOSE="$DC -f docker-compose.dev.yml"

# ─── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[wardkeep]${NC} $1"; }
success() { echo -e "${GREEN}[wardkeep]${NC} $1"; }
warn() { echo -e "${YELLOW}[wardkeep]${NC} $1"; }
error() { echo -e "${RED}[wardkeep]${NC} $1"; }

# ─── Handle flags ────────────────────────────────────────────────────────────

if [ "$1" = "--stop" ]; then
  log "Stopping infrastructure..."
  $COMPOSE down
  success "Infrastructure stopped."
  exit 0
fi

if [ "$1" = "--reset" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public"
  log "Resetting database..."
  $COMPOSE down -v
  $COMPOSE up -d
  log "Waiting for Postgres..."
  until $COMPOSE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
  done
  log "Pushing schema..."
  npx prisma db push
  log "Seeding demo data..."
  npx tsx prisma/seed-demo.ts
  success "Database reset complete. Demo login: demo@wardkeep.app / DemoPassword123"
  exit 0
fi

# ─── Check prerequisites ─────────────────────────────────────────────────────

if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Install Node 22+: https://nodejs.org"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  warn "pnpm not found. Enabling via corepack..."
  corepack enable
fi

# ─── Start infrastructure ────────────────────────────────────────────────────

log "Starting infrastructure (Postgres + Redis)..."
$COMPOSE up -d

log "Waiting for Postgres..."
until $COMPOSE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
success "Postgres ready."

log "Waiting for Redis..."
until $COMPOSE exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done
success "Redis ready."

# ─── Setup database ─────────────────────────────────────────────────────────

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wardkeep?schema=public"

log "Syncing database schema..."
npx prisma db push --skip-generate
success "Database schema synced."

# ─── Generate Prisma client ─────────────────────────────────────────────────

log "Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
success "Prisma client ready."

# ─── Build packages (needed for workspace imports) ───────────────────────────

log "Building packages..."
pnpm turbo build --filter='./packages/*' > /dev/null 2>&1
success "Packages built."

# ─── Start dev servers ───────────────────────────────────────────────────────

echo ""
success "═══════════════════════════════════════════════════════"
success "  Infrastructure ready!"
success "  Postgres: localhost:5432 (postgres/postgres)"
success "  Redis:    localhost:6379"
success "  Web:      http://localhost:3000"
success "  API:      http://localhost:4000"
success "═══════════════════════════════════════════════════════"
echo ""
log "Starting API and Web with hot-reload... (Ctrl+C to stop)"
echo ""

# Export env vars for the API
export REDIS_HOST=localhost
export REDIS_PORT=6379
export PORT=4000
export SESSION_TIMEOUT=30
export ENCRYPTION_KEY=dev-local-key-not-for-production
export AI_PRIVACY_MODE=LOCAL
export OLLAMA_URL=http://localhost:11434

exec pnpm turbo dev --filter='@wardkeep/api' --filter='@wardkeep/web' --parallel
