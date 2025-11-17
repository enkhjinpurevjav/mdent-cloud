FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy application files
COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
