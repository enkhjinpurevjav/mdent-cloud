#!/usr/bin/env sh
# backend/docker-entrypoint.sh
set -e

echo "--- running prisma migrate deploy ---"
# attempt migration; if it fails, we fail fast - change behavior if you prefer
npx prisma migrate deploy

# optionally run seed automatically if RUN_SEED env true
if [ "$RUN_SEED" = "true" ]; then
  echo "--- running seed ---"
  node prisma/seed.js || true
fi

echo "--- starting node app ---"
exec "$@"
