#!/bin/sh
set -e

echo "🚀 Starting MDent Backend..."

# Run Prisma migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Run seed if RUN_SEED is set to true
if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Running database seed..."
  npm run seed
fi

# Start the application
echo "✨ Starting application..."
exec node src/index.js
