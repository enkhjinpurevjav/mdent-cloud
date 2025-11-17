FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema before install so postinstall hook can run
COPY prisma ./prisma

# Install dependencies (postinstall will run prisma generate)
RUN npm install --omit=dev

# Copy application files
COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
