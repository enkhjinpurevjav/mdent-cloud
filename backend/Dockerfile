FROM node:20-slim

WORKDIR /app

# Install build tools (only if needed for native modules)
RUN apt-get update && apt-get install -y --no-install-recommends bash python3 build-essential openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate --log-level debug

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
