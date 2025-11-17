#!/usr/bin/env sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "--- prisma generate (idempotent) ---"
# Safe if already generated; won’t fail the container if generate is unnecessary
npx prisma generate >/dev/null 2>&1 || true

echo "--- prisma migrate deploy ---"
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "--- seeding ---"
  node prisma/seed.js || { echo "Seed failed"; exit 1; }
fi

echo "--- starting app ---"
exec "$@"
