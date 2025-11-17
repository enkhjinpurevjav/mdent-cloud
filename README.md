# MDent Cloud (Monorepo)

Deploys Postgres + Backend (Express) + Frontend (Next.js) + Caddy via Docker Compose. Designed for Portainer "Deploy from Git repository".

## Deploy (Portainer)
1. Stacks > Add stack > Repository.
2. Repository URL: <your GitHub repo URL>
   - Branch: main
   - Compose path: docker-compose.yml
3. Environment variables (paste real values):
   - NODE_ENV=production
   - LOG_LEVEL=info
   - JWT_SECRET=<generate strong hex>
   - ADMIN_PASSWORD=<strong admin password>
   - DB_PASSWORD=<strong db password>
   - RUN_SEED=true (first deploy only, then set to false)
   - NEXT_PUBLIC_API_URL=https://api.mdent.cloud
   - NEXT_PUBLIC_PORTAL_URL=https://book.mdent.cloud
   - NEXT_PUBLIC_CAPTCHA_KEY=placeholder
   - NEXT_PUBLIC_BOOKING_FLOW_VERSION=1
   - RATE_LIMIT_PUBLIC=100
   - RATE_LIMIT_INTERNAL=1000
   - ACCESS_TOKEN_EXPIRY=1h
   - REFRESH_TOKEN_EXPIRY=30d
   - QPAY_CLIENT_ID= (optional)
   - QPAY_SECRET= (optional)
   - EBARIMT_API_KEY= (optional)
   - OTP_PROVIDER_KEY= (optional)
4. Deploy the stack.

## DNS
Point:
- api.mdent.cloud -> VPS IP
- book.mdent.cloud -> VPS IP

Caddy will fetch certificates automatically.

## Verify
- API (temp): http://<VPS_IP>:8080/health
- After DNS + Caddy: https://api.mdent.cloud/health
- Frontend: https://book.mdent.cloud

## After First Success
- Change RUN_SEED=false in Portainer and Update stack.
