#!/usr/bin/env sh
set -e

echo "[entrypoint] prisma migrate deploy (if any migrations)"
npx prisma migrate deploy || true

echo "[entrypoint] prisma db push (ensure tables exist)"
npx prisma db push

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running seed"
  node prisma/seed.js || echo "[entrypoint] seed failed (continuing)"
fi

echo "[entrypoint] starting app"
exec "$@"
