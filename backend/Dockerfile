FROM node:20-slim

WORKDIR /app

# Install build tools (needed for bcrypt and friends)
RUN apt-get update && apt-get install -y --no-install-recommends \
  bash python3 build-essential openssl \
  && rm -rf /var/lib/apt/lists/*

# Install deps first to leverage Docker layer cache
COPY package*.json ./
RUN npm install --omit=dev

# Copy the app (includes prisma/schema.prisma)
COPY . .

# Generate Prisma client (no unsupported flags)
RUN npx prisma generate

# Entrypoint: migrate (if any), db push (ensure schema), optional seed, then start app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
