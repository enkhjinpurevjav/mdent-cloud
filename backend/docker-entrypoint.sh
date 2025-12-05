#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] starting backend init"

# Validate required envs for DB wait (compose should set these)
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "[entrypoint] waiting for Postgres at ${DB_HOST}:${DB_PORT} (db=${POSTGRES_DB}, user=${POSTGRES_USER})"
until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"; do
  sleep 2
done
echo "[entrypoint] Postgres is ready"

SCHEMA_PATH="./prisma/schema.prisma"
if [ -f "${SCHEMA_PATH}" ]; then
  echo "[entrypoint] prisma generate"
  npx prisma generate --schema="${SCHEMA_PATH}" || echo "[entrypoint] prisma generate failed (continuing)"

  echo "[entrypoint] prisma migrate deploy (if any migrations)"
  npx prisma migrate deploy --schema="${SCHEMA_PATH}" || echo "[entrypoint] prisma migrate deploy failed (continuing)"

  echo "[entrypoint] prisma db push (ensure tables exist)"
  npx prisma db push --schema="${SCHEMA_PATH}" || echo "[entrypoint] prisma db push failed (continuing)"
else
  echo "[entrypoint] WARNING: ${SCHEMA_PATH} not found, skipping prisma steps"
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running seed"
  if [ -f "prisma/seed.js" ]; then
    node prisma/seed.js || echo "[entrypoint] seed failed (continuing)"
  elif [ -f "prisma/seed.ts" ]; then
    node --loader ts-node/esm prisma/seed.ts || echo "[entrypoint] seed.ts failed (continuing)"
  else
    echo "[entrypoint] no seed file found, skipping"
  fi
fi

echo "[entrypoint] starting app: $*"
exec "$@"
