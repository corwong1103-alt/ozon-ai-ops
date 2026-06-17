# Aliyun Hong Kong Deployment

This project is prepared for Aliyun Hong Kong ECS, Bailian/DashScope AI, and PostgreSQL.

## Recommended ECS Test Setup

- Region: China Hong Kong
- OS: Ubuntu 22.04 or 24.04 LTS
- Size: 2 vCPU / 4 GiB minimum, 4 vCPU / 8 GiB recommended when PostgreSQL runs on the same ECS
- Public bandwidth: BGP multi-line, pay-by-traffic, 5 Mbps for testing
- Security group: open 22, 80, 443. Do not open 3389 for Linux.

## Environment

Create `.env.production` from `.env.example` and set:

```bash
DATABASE_URL="postgresql://ozon:ozon_change_me@postgres:5432/ozon_ai_ops?schema=public"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
OZON_API_KEY_ENCRYPTION_SECRET="replace-with-a-long-random-secret"

AI_PROVIDER="dashscope"
DASHSCOPE_API_KEY="sk-..."
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_TEXT_MODEL="qwen3.6-plus"
QWEN_FAST_MODEL="qwen3.6-flash"
QWEN_IMAGE_MODEL="qwen-image-2.0-pro"
QWEN_VIDEO_MODEL="happyhorse-1.0-t2v"
```

Use `AI_PROVIDER="mock"` when testing without a Bailian API key.

## First Deploy

```bash
npm install
npm run build
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run prisma:seed
```

For a production database, prefer Aliyun RDS PostgreSQL and replace `DATABASE_URL`.

## Nginx

Copy `deploy/nginx/ozon-ai-ops.conf` into `/etc/nginx/sites-available/`, change `server_name`, enable the site, then add HTTPS with Certbot or Aliyun certificate service.

## Runtime Dependencies

- Bailian/DashScope covers translation, copywriting, customer reply suggestions, and enabled image/video models.
- OSS is reserved for generated media storage. Keep it disabled until real image/video persistence is needed.
- Ozon, 1688, and social publishing still require their own platform APIs.
