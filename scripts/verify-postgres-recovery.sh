#!/usr/bin/env bash
# Create and verify a disposable PostgreSQL recovery drill for a running
# Wardkeep Compose deployment. This never touches the live Wardkeep database;
# it restores only to a new, timestamped database and drops that database when
# the drill finishes.
set -euo pipefail

umask 077

COMPOSE_FILE="${WARDKEEP_COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${WARDKEEP_BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_PATH="${BACKUP_DIR}/wardkeep-${TIMESTAMP}.dump"
DRILL_DATABASE="wardkeep_recovery_drill_${TIMESTAMP//[^0-9]/}"
DRILL_CREATED=false

if ! docker compose version >/dev/null 2>&1; then
  echo "[wardkeep] Docker Compose v2 is required." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[wardkeep] Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE")

postgres_exec() {
  "${COMPOSE[@]}" exec -T postgres sh -c "$1"
}

cleanup() {
  if [[ "$DRILL_CREATED" == true ]]; then
    postgres_exec "dropdb --if-exists -U \"\$POSTGRES_USER\" \"$DRILL_DATABASE\"" || true
  fi
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

echo "[wardkeep] Checking that PostgreSQL is ready..."
for ((attempt = 1; attempt <= 60; attempt++)); do
  if postgres_exec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1"' >/dev/null 2>&1; then
    break
  fi

  if ((attempt == 60)); then
    echo "[wardkeep] PostgreSQL did not make $POSTGRES_DB available within 60 seconds." >&2
    exit 1
  fi

  sleep 1
done

echo "[wardkeep] Creating owner-only backup archive: $ARCHIVE_PATH"
postgres_exec 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' >"$ARCHIVE_PATH"

if [[ ! -s "$ARCHIVE_PATH" ]]; then
  echo "[wardkeep] Backup archive is empty; recovery drill stopped." >&2
  exit 1
fi

echo "[wardkeep] Validating archive readability..."
postgres_exec 'pg_restore --list' <"$ARCHIVE_PATH" >/dev/null

echo "[wardkeep] Restoring into disposable database: $DRILL_DATABASE"
postgres_exec "createdb -U \"\$POSTGRES_USER\" \"$DRILL_DATABASE\""
DRILL_CREATED=true
postgres_exec "pg_restore -U \"\$POSTGRES_USER\" -d \"$DRILL_DATABASE\" --no-owner --no-privileges" <"$ARCHIVE_PATH"

TABLE_COUNT="$(postgres_exec "psql -U \"\$POSTGRES_USER\" -d \"$DRILL_DATABASE\" -tAc \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\"")"
if [[ ! "$TABLE_COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "[wardkeep] Restored database has no public tables; recovery drill failed." >&2
  exit 1
fi

echo "[wardkeep] Recovery drill passed: archive is readable and restored $TABLE_COUNT public tables."
echo "[wardkeep] Keep the archive somewhere secure, or remove it after your backup-retention process confirms it."
