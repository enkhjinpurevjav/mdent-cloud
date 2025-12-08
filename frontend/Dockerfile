FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --progress=false
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAL_URL
ARG NEXT_PUBLIC_CAPTCHA_KEY
ARG NEXT_PUBLIC_BOOKING_FLOW_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL \
    NEXT_PUBLIC_CAPTCHA_KEY=$NEXT_PUBLIC_CAPTCHA_KEY \
    NEXT_PUBLIC_BOOKING_FLOW_VERSION=$NEXT_PUBLIC_BOOKING_FLOW_VERSION
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm","start"]
