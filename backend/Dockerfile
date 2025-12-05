FROM node:20-slim

WORKDIR /app

# Tools incl. pg_isready and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
  bash python3 build-essential openssl curl postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Prod deps
COPY package*.json ./
RUN npm install --omit=dev

# App code (must include prisma/schema.prisma)
COPY . .

# Generate Prisma client at build-time (optional but safe if schema is present)
# Remove unsupported flag; point to schema explicitly.
RUN npx prisma generate --schema=./prisma/schema.prisma

# Entrypoint still runs DB wait + migrations at runtime
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
