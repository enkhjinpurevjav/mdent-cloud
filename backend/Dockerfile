FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# If you add Prisma later, you can add: RUN npx prisma generate
EXPOSE 8080
CMD ["npm","start"]
