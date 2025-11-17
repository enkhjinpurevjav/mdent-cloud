 url=https://github.com/enkhjinpurevjav/mdent-cloud/blob/main/backend/Dockerfile
# backend/Dockerfile (updated)
FROM node:20-alpine

WORKDIR /app

# install build deps
RUN apk add --no-cache python3 make g++ bash

# copy package and install first to leverage cache
COPY package*.json ./
RUN npm ci --production

# copy prisma schema and run prisma generate to include client in image
COPY prisma ./prisma
RUN npx prisma generate

# copy rest of app
COPY . .

# ensure entrypoint is executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
