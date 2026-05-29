# Ozon Seller AI Ops MVP - Conversation Context

This document records the project context from the initial planning conversation so future work can continue without losing product intent.

## Original Request

Build an **Ozon seller AI operations dashboard MVP**.

Required stack:

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma

Product logic:

- After login, the user can bind either a Russia Ozon store or a Kazakhstan Ozon store.
- Each store must save:
  - Store name
  - Country: `Russia` or `Kazakhstan`
  - Ozon Client ID
  - Ozon API Key
  - Whether it is the default store

Required pages:

- Login / registration
- Store selection
- Store binding
- Store management list
- 1688 product collection page with mock data
  - Keyword product search
  - Price range filtering
  - Sales sorting
  - Weekly / monthly top 20 hot-selling products
- Product detail editing page
  - Title
  - Description
  - Price
  - Images
  - Russian translation placeholder button
  - AI product image generation placeholder button
- Upload to Ozon button
  - User must select a bound store first
  - API structure only; no real upload yet
- Task log page
  - Collection tasks
  - Translation tasks
  - Image generation tasks
  - Upload tasks

Required database models:

- `User`
- `Store`
- `Product`
- `ProductImage`
- `TaskLog`

## Delivered Project Files

Main app project:

- `app/`
- `components/`
- `lib/`
- `prisma/schema.prisma`
- `tailwind.config.ts`
- `package.json`
- `README.md`

Static demo page:

- `ozon-mvp-demo.html`

The static demo was created because dependency installation was blocked by network restrictions, while the user wanted an immediately viewable page.

## Design Direction

The UI direction is **industrial operations console**:

- Dense, practical dashboard layout
- Store and country status markers
- Operator-focused tables and forms
- Restrained palette using ink, paper, steel, rust, and mint
- First screen is the actual product experience, not a marketing page

## Current Implementation Notes

The Next.js version includes:

- App Router pages
- Mock auth routes
- Mock store APIs
- Mock product collection APIs
- Product update route
- Translation, image generation, and upload placeholder routes
- Task log route
- Prisma schema for the real PostgreSQL persistence layer

The MVP currently uses in-memory mock data in:

- `lib/mock-db.ts`

The Prisma client helper is prepared in:

- `lib/prisma.ts`

Production persistence can be added later by replacing mock data access with Prisma calls.

## Static Demo

The user asked for a directly rendered web experience.

Created:

- `ozon-mvp-demo.html`

Latest update on 2026-05-25:

- Replaced the project demo entry with the fixed HTML supplied by the user:
  `/Users/bigcor/Downloads/ozon-mvp-demo-ozon-fixed.html`
- The stable project link remains:
  `file:///Users/bigcor/Documents/ozon/ozon-mvp-demo.html`

Latest content update on 2026-05-26:

- Updated the static website content according to the user's feature map image.
- The website is now framed as a multi-agent Ozon cross-border operations site.
- New content structure:
  - Daily login and Ozon cross-border store selection.
  - Binding Ozon store ID, Client ID, and API Key.
  - Agent1 crawler for 1688 and Ozon research.
  - 1688/Ozon research supports weekly/monthly hot top 20, price range lookup, sales sorting, and keyword product search.
  - Selected products can create upload drafts for the chosen Ozon store.
  - Agent2 generates product images from descriptions and translates image/product text into Russian.
  - Agent3 handles TikTok, Instagram, and VK authorization, AI asset generation, and auto-publishing.
  - Agent4 handles customer automatic replies and reminder rules.

Latest SaaS logic update on 2026-05-26:

- Rebuilt the HTML demo around the new product positioning: a private Ozon AI cross-border operations platform, not an open-registration public site.
- Registration now creates a pending user. Pending users see only the audit-waiting page.
- Approved users can enter the dashboard.
- Expired and suspended users see separate blocked-state pages.
- Updated AI credit rules:
  - Translation is now a base approved-account feature and does not consume credits.
  - `imageCredits` is consumed only by AI product image generation.
  - `videoCredits` is consumed only by AI video generation.
  - Social image posting and customer auto-replies are base operations and do not consume credits.
- Added starter/pro/vip plan display and plan quota examples.
- Added admin simulation:
  - approve users
  - suspend users
  - set plan
  - set expiry
  - add/deduct AI credits
  - view usage records and bound Ozon stores

Latest social/customer update on 2026-05-26:

- Social publishing and customer assistant modules were restored and kept as required platform functions.
- Social publishing supports TikTok, Instagram, and VK account authorization.
- Social module can generate title, copy, hashtags, image material, and video material from products.
- Image social publishing does not consume credits.
- AI video social publishing consumes `videoCredits`.
- Customer assistant includes Ozon messages, message category recognition, suggested replies, one-click reply, important alerts, and customer task logs.
- Admin dashboard now also shows social authorization state and customer reminder state.
- Data model notes now include `SocialAccount`, `SocialPost`, and `CustomerMessage` for later backend implementation.

This is a single-file static interactive demo. It can be opened directly in a browser and supports:

- Login demo
- Store selection
- Store binding
- Store management
- 1688 mock product collection
- Ozon mock market research
- Product editing
- Russian translation placeholder
- AI image generation placeholder
- Social media authorization and auto-publish placeholder
- Customer service auto-reply and reminder placeholder
- Upload placeholder
- Task log updates

The in-app browser was able to display the `file://` page, but browser automation was blocked from interacting with local file pages by security policy.

## Sharing Notes

The local link:

```text
file:///Users/bigcor/Documents/ozon/ozon-mvp-demo.html
```

only works on the user's Mac because it points to a local file path.

Ways to share:

- Send `ozon-mvp-demo.html` as an attachment.
- Upload it to GitHub Pages, Vercel, Netlify, or another static hosting provider.
- Run a local HTTP server and share a LAN URL with devices on the same Wi-Fi.

Example LAN server command:

```bash
cd /Users/bigcor/Documents/ozon
python3 -m http.server 8000 --bind 0.0.0.0
```

Then get the Mac's Wi-Fi IP:

```bash
ipconfig getifaddr en0
```

Example mobile URL:

```text
http://192.168.1.23:8000/ozon-mvp-demo.html
```

## Mobile Codex Issue

The user showed a mobile ChatGPT / Codex screen with:

- Device: `MacBookAir`
- Status: red dot
- Message: unable to complete operation
- Error family: `CodexAppServer.CodexClientError`
- Reconnect button

Assessment:

- This is not an issue with the Ozon HTML page.
- It is a mobile ChatGPT Codex connection issue to the Mac Codex local app.
- The red dot suggests the Mac Codex client is offline, unavailable, blocked, or not fully connected.

Recommended checks:

- Keep Codex open on the Mac.
- Confirm mobile ChatGPT and Mac Codex use the same account and workspace.
- Prevent the Mac from sleeping.
- Temporarily disable VPN/proxy if connection is unstable.
- Update both ChatGPT mobile and Codex desktop.
- Tap reconnect on mobile.
- Restart Codex on the Mac.
- Check workspace/admin settings if using Team, Enterprise, or Edu.

## Known Environment Constraints

Dependency install failed because the sandbox could not resolve npm registry:

```text
getaddrinfo ENOTFOUND registry.npmjs.org
```

Local server startup from the sandbox was blocked by permission restrictions:

```text
PermissionError: [Errno 1] Operation not permitted
listen EPERM: operation not permitted 127.0.0.1:4173
```

Because of those constraints, the Next.js app has not been build-verified locally in this environment.

## Next Recommended Development Steps

1. Install dependencies in a normal network environment:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

2. Replace `lib/mock-db.ts` with Prisma-backed persistence.

3. Add real auth/session handling.

4. Add encrypted storage for Ozon API keys.

5. Implement real 1688 collection integration or browser/import workflow.

6. Implement real Russian translation and AI image generation endpoints.

7. Implement Ozon upload payload validation and real API integration.
