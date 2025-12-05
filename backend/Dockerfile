FROM node:20-slim

WORKDIR /app

# Install build tools and curl (for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
  bash python3 build-essential openssl curl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (prod only)
COPY package*.json ./
RUN npm install --omit=dev

# Copy app (includes prisma schema and seed)
COPY . .

# Entrypoint (prisma generate + migrate at runtime, after DB is ready)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

# Use bash explicitly to avoid sh incompatibilities in the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
