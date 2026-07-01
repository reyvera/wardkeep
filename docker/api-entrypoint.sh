#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding default data if needed..."
npx prisma db seed || true

echo "Starting API server..."
exec "$@"
