FROM node:20-slim

WORKDIR /app

# Tools for pg_isready and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
  bash python3 build-essential openssl curl postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Use lockfile for deterministic install
COPY package*.json ./
RUN npm ci --no-audit --progress=false

# App code (includes prisma/schema.prisma)
COPY . .

# Generate Prisma client at build-time (optional)
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
