#!/usr/bin/env sh
set -e

echo "--- prisma migrate deploy ---"
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "--- seeding ---"
  node prisma/seed.js || true
fi

echo "--- starting app ---"
exec "$@"
