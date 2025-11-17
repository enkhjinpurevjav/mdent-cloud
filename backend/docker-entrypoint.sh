#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy || exit 1

echo "Starting application..."
exec node src/index.js
