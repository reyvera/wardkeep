#!/bin/sh
set -e

# Safety check: refuse to start with default encryption key in production
if [ "$ENCRYPTION_KEY" = "change-me-in-production" ] && [ "$DEMO_MODE" != "true" ]; then
  echo "ERROR: ENCRYPTION_KEY is set to the default value."
  echo "Please set a secure random value in your .env file:"
  echo "  ENCRYPTION_KEY=$(openssl rand -hex 32)"
  echo ""
  echo "To bypass this check (demo/testing only), set DEMO_MODE=true"
  exit 1
fi

echo "Running checked-in database migrations..."
if ! node node_modules/prisma/build/index.js migrate deploy; then
  if [ "$WARDKEEP_BASELINE_EXISTING_DATABASE" = "true" ]; then
    echo "Baselining an existing database after a strict schema check..."
    node scripts/baseline-prisma-migrations.mjs
    echo "Rechecking recorded database migrations..."
    node node_modules/prisma/build/index.js migrate deploy
  else
  echo ""
  echo "ERROR: Database migrations failed. Wardkeep will not start because continuing could risk data."
  echo "If this database was created by an older development image without migration history,"
  echo "restore/verify a backup and run once with WARDKEEP_BASELINE_EXISTING_DATABASE=true."
  echo "That operation only records migration history after confirming the schema is an exact match."
  exit 1
  fi
fi

# Demo data is never seeded automatically in an application image. It is an
# explicit local-development action so an update can never alter a household.

echo "Starting API server..."
exec "$@"
