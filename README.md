# Ozon AI Ops SaaS

Next.js + TypeScript + Tailwind CSS + PostgreSQL + Prisma SaaS foundation for a private Ozon cross-border AI operations platform.

## Current Build Scope

- Real project architecture for a private SaaS app.
- Prisma database schema for users, sessions, AI credits, stores, products, social accounts, customer messages, task logs, and admin action logs.
- Register/login API with password hashing and HTTP-only session cookies.
- User status gates: `pending`, `approved`, `expired`, `suspended`.
- Approved-user guards for dashboard, store binding, task logs, and module pages.
- Admin-only user review page with approve, suspend, expire, plan, and expiry actions.
- Middleware that blocks protected routes when no session cookie is present.
- SaaS page framework for Dashboard, Ozon 店铺, Ozon 调研, 1688 采集, 商品池, AI额度, 社媒发布, 客服助手, 任务记录, 管理后台.
- Phase 3 pages use real database reads/writes with local mock services; no third-party Ozon, 1688, AI, social, or customer-service API is called.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL via Prisma
- Cookie-based session auth

## Getting Started

```bash
npm install
cp .env.example .env
npm run db:start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

Seeded demo accounts:

- `admin@demo.com` / `demo123456`
- `operator@demo.com` / `demo123456`
- `pending@demo.com` / `demo123456`

Seed data also includes one mock Ozon store, one mock product, social account status rows, one customer message, and sample task logs. No third-party Ozon, 1688, AI, social, or customer service API is called in Phase 1.

## Database

The Prisma schema is in `prisma/schema.prisma` and contains:

- `User`
- `Session`
- `AiCredits`
- `Store`
- `Product`
- `SocialAccount`
- `SocialPost`
- `CustomerMessage`
- `TaskLog`
- `AdminActionLog`

The current API routes use Prisma directly. The HTML demo remains as a static reference, but the SaaS app no longer depends on mock in-memory storage.

## Environment Variables

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ozon_ai_ops?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OZON_API_KEY_ENCRYPTION_SECRET="replace-with-a-long-random-secret"
AI_API_KEY=""
OZON_API_BASE_URL=""
```

## Auth And Permissions

- Registration creates a `pending` user.
- Login creates an HTTP-only cookie session.
- `middleware.ts` blocks protected pages without a session cookie.
- Server guards in `lib/auth.ts` enforce status-level access:
  - `pending` -> `/pending`
  - `expired` -> `/expired`
  - `suspended` -> `/suspended`
  - `approved` -> dashboard and module pages
- Admin pages require `role = admin`.

## Phase 3 Mock Interactions

- Ozon 调研 and 1688 采集 use `lib/services/mock-market.ts` for local search, filters, weekly/monthly hot products, sales sorting, and adding products to the database-backed product pool.
- 商品池 supports create, edit, translate, image text translation, AI product image, AI video, and mock upload to Ozon.
- AI商品图 consumes `imageCredits`; AI视频 consumes `videoCredits`; translation, upload, customer replies, and social image publishing cost `0`.
- 社媒发布 supports mock TikTok / Instagram / VK authorization status, social copy generation, image publish, and AI video publish.
- 客服助手 supports mock Ozon messages, category labels, AI reply suggestions, and one-click reply.
- All business actions write `TaskLog` with `creditCost`.

## Main Routes

- `/login`
- `/register`
- `/dashboard`
- `/stores/new`
- `/stores`
- `/research/ozon`
- `/collector`
- `/products`
- `/products/[id]`
- `/credits`
- `/social`
- `/customer`
- `/tasks`
- `/admin`

## API Routes

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET|POST /api/stores`
- `GET /api/products/search`
- `GET|PATCH /api/products/[id]`
- `POST /api/products/[id]/translate`
- `POST /api/products/[id]/translate-image-text`
- `POST /api/products/[id]/generate-image`
- `POST /api/products/[id]/generate-video`
- `POST /api/products/[id]/upload`
- `GET /api/tasks`

## Conversation Context

The original product requirements, demo notes, sharing guidance, and mobile Codex troubleshooting notes are documented in:

- `docs/conversation-context.md`
- `docs/codex-chat-transcript-2026-05-25.md`

## Static Demo

The latest fixed static demo is available at:

- `ozon-mvp-demo.html`

Local file URL:

```text
file:///Users/bigcor/Documents/ozon/ozon-mvp-demo.html
```

Latest content update on 2026-05-26:

- Reworked the demo around the user's feature map image.
- Added the four-agent operations structure:
  Agent1 crawler, Agent2 image/Russian generation, Agent3 social publishing, Agent4 customer service.
- Added a visible website function blueprint on the dashboard.

Latest SaaS logic update on 2026-05-26:

- Rebuilt the static demo as a private, admin-approved Ozon AI cross-border operations platform.
- Added user states: pending, approved, expired, suspended.
- Added AI credit checks and deduction for image, translation, video, and social publishing.
- Added plan display for starter, pro, and vip.
- Added store binding without Russia/Kazakhstan choice: unified Ozon cross-border store ID + API Key.
- Added admin dashboard actions for approval, suspension, plan/expiry, and credit adjustment.

Latest AI credit update on 2026-05-26:

- Removed translation from the AI credit consumption logic.
- Translation is now a base feature for approved users and records `creditCost = 0`.
- Only AI product images consume `imageCredits`.
- Only AI videos consume `videoCredits`.
- Social image publishing does not consume credits; AI video publishing consumes `videoCredits`.

Latest social/customer update on 2026-05-26:

- Restored the Social Publishing module in the main navigation.
- Restored the Customer Assistant module in the main navigation.
- Social image posts are base functions and do not consume credits.
- Social AI video posts consume `videoCredits`.
- Customer auto-replies, alerts, and suggested replies are base operations and do not consume credits.
