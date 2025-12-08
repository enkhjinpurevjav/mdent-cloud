
echo "[entrypoint] starting backend init"

# Validate required envs for DB wait (compose should set these)
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
SCHEMA_PATH="./prisma/schema.prisma"

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
  echo "[entrypoint] prisma migrate deploy"
  npx prisma migrate deploy --schema="${SCHEMA_PATH}" || echo "[entrypoint] migrate deploy failed (continuing)"

  echo "[entrypoint] prisma db push (ensure tables exist)"
  npx prisma db push --schema="${SCHEMA_PATH}" || echo "[entrypoint] prisma db push failed (continuing)"
  echo "[entrypoint] prisma db push"
  npx prisma db push --schema="${SCHEMA_PATH}" || echo "[entrypoint] db push failed (continuing)"
else
echo "[entrypoint] WARNING: ${SCHEMA_PATH} not found, skipping prisma steps"
fi
