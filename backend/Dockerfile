FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
