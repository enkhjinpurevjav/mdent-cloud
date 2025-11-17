FROM node:20-alpine

WORKDIR /app

# tools for native builds (safe even if not strictly needed)
RUN apk add --no-cache bash python3 make g++

# install packages first to leverage cache
COPY package*.json ./
# use install (not ci) since there is no package-lock.json yet
RUN npm install --omit=dev

# include prisma client in the image
COPY prisma ./prisma
RUN npx prisma generate

# copy app code
COPY . .

# entrypoint that runs migrations then starts the app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node","src/index.js"]
