#!/usr/bin/env sh
set -e

echo "--- prisma migrate deploy ---"
# Run migrations if present; don’t fail if none exist
npx prisma migrate deploy || true

echo "--- prisma db push (ensure schema is applied) ---"
npx prisma db push

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "--- seeding ---"
  node prisma/seed.js || true
fi

echo "--- starting app ---"
exec "$@"
