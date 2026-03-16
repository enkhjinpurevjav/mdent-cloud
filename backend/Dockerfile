FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  bash python3 build-essential openssl curl \
  && rm -rf /var/lib/apt/lists/*

# Install deps INCLUDING dev deps so prisma CLI exists during build
COPY package*.json ./
RUN npm ci

# Copy source + prisma schema
COPY . .

# Generate Prisma Client at build time (so runtime never uses stale client)
RUN npx prisma generate

# Remove dev deps for production image size
RUN npm prune --omit=dev

# Entrypoint
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
