FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache bash python3 make g++

# Install deps (no lockfile yet -> npm install)
COPY package*.json ./
RUN npm install --omit=dev

# Generate Prisma client into image
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the app
COPY . .

# Entrypoint runs migrations/db push then starts the app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
