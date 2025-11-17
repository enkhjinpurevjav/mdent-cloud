FROM node:20-alpine

WORKDIR /app

# System libs required by Prisma on Alpine
RUN apk add --no-cache bash python3 make g++ openssl libc6-compat

# Copy package manifests & install deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy entire app (schema + source)
COPY . .

# (Re)generate Prisma client with debug logs
RUN npx prisma generate --log-level debug

# Entrypoint: apply migrations/schema, optional seed, start server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
