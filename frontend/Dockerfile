FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install


ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_CAPTCHA_KEY
ARG NEXT_PUBLIC_BOOKING_FLOW_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_CAPTCHA_KEY=$NEXT_PUBLIC_CAPTCHA_KEY \
    NEXT_PUBLIC_BOOKING_FLOW_VERSION=$NEXT_PUBLIC_BOOKING_FLOW_VERSION

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm","start"]
