FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Use npm ci if package-lock.json is committed; otherwise npm install
RUN npm install

# Copy the rest of the source (critical!)
COPY . .

# Build-time public env vars
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_CAPTCHA_KEY
ARG NEXT_PUBLIC_BOOKING_FLOW_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_CAPTCHA_KEY=$NEXT_PUBLIC_CAPTCHA_KEY \
    NEXT_PUBLIC_BOOKING_FLOW_VERSION=$NEXT_PUBLIC_BOOKING_FLOW_VERSION

# Make sure public exists (harmless if already there)
RUN mkdir -p public

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm","start"]
