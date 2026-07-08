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

echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate 2>/dev/null || true

echo "Seeding demo user (skipped if already exists)..."
node prisma/seed-demo.js || true

echo "Starting API server..."
exec "$@"
