# OzonAI 安全与架构完整性审查报告

**审查日期**: 2026-07-07  
**审查范围**: /Users/bigcor/Documents/ozon/  
**项目阶段**: V5 Beta  
**技术栈**: Next.js 14 + TypeScript + Tailwind CSS + PostgreSQL + Prisma

---

## 目录

1. [安全审计](#1-安全审计)
2. [电商功能完整性](#2-电商功能完整性)
3. [AI 生图匹配度分析](#3-ai-生图匹配度分析)
4. [搜索持久化分析](#4-搜索持久化分析)
5. [数据库 Schema 完整性](#5-数据库-schema-完整性)
6. [中间件和路由保护](#6-中间件和路由保护)
7. [依赖分析](#7-依赖分析)
8. [问题汇总与优先级](#8-问题汇总与优先级)

---

## 1. 安全审计

### 1.1 API 路由认证/授权

**整体评价**: 认证体系设计合理，但存在一个关键漏洞。

**正面发现**:
- 所有 API 路由均调用 `requireApprovedUser()` 或 `requireAdminUser()` 进行认证 ✅
- 数据查询均带 `userId` 过滤，实现用户级数据隔离 ✅
- Server Actions 也正确调用认证函数 ✅
- 密码使用 scrypt + salt + timingSafeEqual 安全比较 ✅

**🔴 严重问题 — API 路由 `/api/*` 未受 middleware 保护**:

- **文件**: `middleware.ts`
- **问题**: `protectedPrefixes` 只包含页面路由（`/admin`, `/dashboard` 等），**不包含 `/api`**。虽然每个 API route handler 内部调用了 `requireApprovedUser()`，但 middleware 层面未做拦截。
- **影响**: 如果某个 API route handler 遗漏了认证调用，将完全暴露。当前依赖开发者纪律而非系统保障。
- **建议**: 在 `protectedPrefixes` 中添加 `"/api"`，并排除 `/api/auth/login` 和 `/api/auth/register`。

**🟡 中等 — 订单同步只写 TaskLog，不创建 Order 记录**:

- **文件**: `app/api/stores/[id]/ozon-sync/route.ts` (行 120-143)
- **问题**: `mode === "orders"` 分支只写 TaskLog metadata，不创建任何订单数据模型。订单数据仅存在于 TaskLog.metadata JSON 中，无法查询、统计或管理。
- **影响**: 无订单管理能力，影响电商完整性（见第 2 节）。

### 1.2 环境变量暴露

**🔴 严重 — `.env` 文件存在于仓库目录中且可能被提交**:

- **文件**: `.env`（含 DATABASE_URL、AI_API_KEY、OZON_API_KEY_ENCRYPTION_SECRET、APIFY_TOKEN 等真实密钥）
- **状态**: `.gitignore` 已包含 `.env`，但文件物理存在于项目目录。
- **影响**: 如果 `.gitignore` 配置有误或通过其他方式同步，密钥将泄露。
- **建议**: 确认 `.env` 未被 git tracked（`git ls-files .env`）；生产环境使用阿里云 KMS 或 Docker secrets。

**🟡 中等 — 加密密钥开发环境硬编码回退**:

- **文件**: `lib/crypto.ts` (行 12-14)
```typescript
function getEncryptionKey() {
  const secret = process.env.OZON_API_KEY_ENCRYPTION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OZON_API_KEY_ENCRYPTION_SECRET is required in production.");
  }
  return createHash("sha256").update(secret || "dev-only-ozon-api-key-secret").digest();
}
```
- **问题**: 开发环境使用硬编码 `"dev-only-ozon-api-key-secret"` 作为加密密钥。如果开发环境的 NODE_ENV 未设为 production，所有加密的 API Key 实际上用已知密钥加密。
- **建议**: 开发环境也强制要求环境变量，或使用 `.env.local` 明确配置。

**🟡 中等 — `getDashscopeRuntimeConfig` 回退到环境变量 `AI_API_KEY`**:

- **文件**: `lib/integrations.ts` (行 168-169)
```typescript
const apiKey = effectiveIntegration?.secretEncrypted
  ? decryptSecret(effectiveIntegration.secretEncrypted)
  : process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY || "";
```
- **问题**: 当用户未配置 integration 时，回退到全局环境变量 `AI_API_KEY`，意味着任何已认证用户都能使用全局 AI 额度，无用户级配额隔离。
- **影响**: 用户可无限制消耗全局 AI 额度。

### 1.3 SQL 注入风险

**✅ 无风险**: 全项目使用 Prisma ORM，所有数据库操作通过 Prisma Client 或 `$transaction`，未发现原始 SQL 查询。唯一的手动 SQL 文件 `scripts/BACKUP_SOURCE_MAPPING.sql` 是维护脚本，不在运行时执行。

### 1.4 XSS 风险

**🟡 中等 — AI 生成内容直接渲染**:

- **文件**: `components/AiStudioClient.tsx` (行 54)
```tsx
{result.content && (
  <pre className="ai-studio-result-content">{result.content}</pre>
)}
```
- **问题**: AI 生成的文本内容直接在 `<pre>` 中渲染。React 默认转义 JSX 子节点，所以这里实际安全。但如果未来有 `dangerouslySetInnerHTML` 的使用（当前未发现），则存在风险。
- **当前状态**: ✅ 安全（React 自动转义）

**🟡 中等 — 图片代理 SVG 响应中的用户可控内容**:

- **文件**: `app/api/image-proxy/route.ts` (行 8-11)
```typescript
function unavailableImage(reason: string) {
  const safeReason = reason.replace(/[<>&\"]/g, "");
  const svg = `<svg ...>${safeReason}</svg>`;
```
- **问题**: `safeReason` 来自 HTTP 状态码或固定字符串，做了基本的 XSS 过滤。但过滤不完整 — 未处理 `(` `)` `javascript:` 等攻击向量。
- **建议**: 使用 DOMPurify 或限制为白名单字符 `[\w\s-]`。

### 1.5 CSRF 防护

**🔴 严重 — 无 CSRF 防护机制**:

- **问题**: 项目未使用 CSRF token 或 SameSite=strict cookie。
- **文件**: `lib/auth.ts` (行 44-51) — cookie 设置为 `sameSite: "lax"`
- **影响**: 
  - `sameSite: "lax"` 阻止跨站 POST 请求携带 cookie，但 GET 请求仍可被利用。
  - Server Actions 使用 POST，受 lax 保护。
  - 但 `app/api/products/[id]/route.ts` 的 GET 端点会返回商品数据，可能被 CSRF 攻击读取。
- **建议**: 
  1. 对状态变更 API 添加 CSRF token 或 Origin/Referer 检查。
  2. 考虑将 cookie 改为 `sameSite: "strict"`（需评估对第三方嵌入的影响）。

### 1.6 CORS 配置

**🔴 严重 — 无 CORS 配置**:

- **文件**: `next.config.mjs`
```javascript
const nextConfig = {};
export default nextConfig;
```
- **问题**: `next.config.mjs` 完全为空，未配置 CORS headers。Next.js API routes 默认不发送 CORS headers，意味着：
  - 同源请求正常工作。
  - 跨域请求被浏览器默认阻止（无 `Access-Control-Allow-Origin`）。
- **影响**: 当前为同源应用，暂无跨域需求。但如果未来需要前端分离或第三方集成，需要配置。
- **建议**: 在 `next.config.mjs` 中添加 `headers()` 配置，明确限制允许的来源。

### 1.7 密钥管理

**✅ 正面发现**:
- Ozon API Key 使用 AES-256-GCM 加密存储 ✅
- Session token 使用 SHA-256 哈希后存储，不存明文 ✅
- 密码使用 scrypt + random salt 哈希 ✅
- Apify token 通过 integration 系统加密存储 ✅

**🟡 中等 — Session 过期不主动清理**:

- **文件**: `lib/auth.ts`
- **问题**: 过期 session 在 `getCurrentUser()` 调用时才被删除（懒删除）。无定时任务清理过期 session。
- **影响**: 数据库中会积累过期 session 记录。
- **建议**: 添加定时清理任务或在 `createSession` 时顺便清理该用户的过期 session。

**🟡 中等 — Session 无并发控制**:

- **问题**: 用户可以在多个设备/浏览器创建无限数量的 session，无最大 session 数限制。
- **建议**: 限制每用户最大活跃 session 数（如 5 个），超出时删除最旧 session。

### 1.8 图片代理 SSRF 风险

**🟡 中等 — 图片代理可被用作 SSRF 跳板**:

- **文件**: `app/api/image-proxy/route.ts`
- **问题**: 
  - 虽然屏蔽了 `localhost`、`example.com` 等域名，但未屏蔽内网 IP 段（`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`169.254.0.0/16`）。
  - 攻击者可构造 `?url=http://10.0.0.1:8080/` 探测内网服务。
  - 未屏蔽 `0.0.0.0`、`[::1]` 等 IPv6 本地地址。
- **影响**: 内网端口扫描、访问云元数据服务（如阿里云 `100.100.100.200`）。
- **建议**: 添加内网 IP 段黑名单，或使用 DNS 解析后验证 IP 再请求。

---

## 2. 电商功能完整性

### 2.1 商品生命周期

**✅ 完整**: 9 阶段状态机设计完善
- **文件**: `prisma/schema.prisma` (ProductStatus enum) + `lib/product-lifecycle.ts`
- 状态: `discovered → favorited → in_product_center → optimizing → optimized → ready_to_publish → published → promoted → archived`
- 转换逻辑在 `app/products/actions.ts` 中实现，有状态前置检查 ✅
- 每次状态转换都记录 TaskLog ✅

### 2.2 订单流程

**🔴 严重缺失 — 无订单数据模型**:

- **问题**: Prisma schema 中**没有 Order 模型**。订单数据仅作为 TaskLog.metadata 的 JSON 快照存在。
- **文件**: `app/api/stores/[id]/ozon-sync/route.ts` (行 120-143) — orders 同步只写 TaskLog
- **影响**: 
  - 无法查询历史订单
  - 无订单状态跟踪
  - 无订单与商品的关联
  - 无订单财务数据管理
- **必需模型**: `Order`（订单号、状态、金额、物流、买家信息）、`OrderItem`（商品、数量、单价）

### 2.3 支付集成

**🔴 严重缺失 — 无支付功能**:

- **问题**: 代码中无任何支付集成代码。无支付网关、无支付记录、无退款流程。
- **影响**: 作为 SaaS 平台，缺少用户付费/订阅管理能力。当前只有 `UserPlan` (starter/pro/vip) 和 `AiCredits` 但无付费获取额度的流程。
- **建议**: 集成支付宝/微信支付/Stripe，实现 plan 升级和 credits 充值。

### 2.4 库存管理

**🔴 严重缺失 — 无库存模型**:

- **问题**: Product 模型无 `stock` 字段，无 `Inventory` 模型，无 SKU 变体管理。
- **影响**: 无法管理商品库存、无法同步 Ozon 库存、无法设置库存预警。
- **建议**: 添加 `stock` 字段或独立 `Inventory` 模型，关联 Store 和 Product。

### 2.5 Ozon 上传功能

**🟡 中等 — 真实上传实现不完整**:

- **文件**: `lib/services/ozon.ts` `uploadProductToOzon()`
- **问题**: 
  - 默认 `dry-run` 模式（`OZON_REAL_UPLOAD` 未设为 `true`）
  - 真实上传调用 `/v3/product/create` 但**缺少 category_id 和 attributes**（代码注释也提到 "当前简化"）
  - Ozon API 实际要求 category_id + attributes + 多维 SKU 信息
- **影响**: 真实上传到 Ozon 大概率会失败。
- **建议**: 实现完整的 Ozon product create payload，包括 category tree 查询和属性映射。

---

## 3. AI 生图匹配度分析

### 3.1 Image-to-Image 实现位置

**核心文件**: `lib/ai/provider.ts` — `generateImage()` 函数

```typescript
export async function generateImage(input: MediaInput) {
  const config = await getDashscopeRuntimeConfig(input.userId);
  if (!shouldUseDashscope(config)) {
    return { url: "", provider: "mock", prompt: input.prompt };
  }

  const content: Record<string, string>[] = [];
  if (input.referenceImage) {
    content.push({ image: input.referenceImage });
  }
  content.push({ text: input.prompt });

  const data = await dashscopeNativeFetch(config, 
    "/api/v1/services/aigc/multimodal-generation/generation", {
    model: input.model || config.imageModel,
    input: { messages: [{ role: "user", content }] },
    parameters: { n: 1, size: normalizeImageSize(config.imageSize), 
                  prompt_extend: true, watermark: false }
  });
  return { url: extractNativeImageUrl(data), provider: "dashscope", prompt: input.prompt, raw: data };
}
```

### 3.2 匹配度差的根因分析

**🔴 核心问题 1 — 使用了错误的多模态接口**:

- **调用的 API**: `/api/v1/services/aigc/multimodal-generation/generation`
- **问题**: 这是**通义千问多模态对话接口**（qwen-vl 系列），不是专门的 image-to-image 接口。它接收图片作为"理解"输入，但生成的图片是基于文本 prompt 的新图，不是基于参考图的变换。
- **正确做法**: 应使用 DashScope 的 **通义万相文生图** (`/api/v1/services/aigc/text2image/image-synthesis`) 配合 `ref_img` 参数，或使用 **图像编辑** API (`/api/v1/services/aigc/image2image/image-synthesis`)。

**🔴 核心问题 2 — 参考图 URL 未传到实际生成**:

- **文件**: `lib/ai/prompts.ts` — `buildProductImagePrompt()`
- **问题**: 商品图生成 prompt 函数**完全不包含参考图信息**：
```typescript
export function buildProductImagePrompt(product: ProductInput) {
  return [
    "生成一张 Ozon 跨境电商商品主图。",
    "风格：干净真实的电商摄影，浅色背景，商品清晰居中...",
    `商品：${product.title}`,
    `描述：${product.description}`
  ].join("\n");
}
```
- **影响**: `generate-image` route 调用 `runCreditAiTask` 时传入的 prompt 不含参考图，且 `runCreditAiTask` 内部调用 `generateImage({ prompt })` 时**不传 `referenceImage`**：

- **文件**: `lib/services/ai.ts` (行 73-75)
```typescript
const aiResult = input.prompt
  ? input.kind === "image"
    ? await generateImage({ prompt: input.prompt, userId: input.userId })
    : await generateVideo({ prompt: input.prompt, userId: input.userId })
  : null;
```
- **关键缺陷**: `runCreditAiTask` 调用 `generateImage` 时**只传 prompt，不传 referenceImage**。

**🔴 核心问题 3 — AiGeneratedImagePanel 的参考图未到达生成 API**:

- **文件**: `components/AiGeneratedImagePanel.tsx`
- **问题**: 用户在面板中选择参考图后，`referenceImage` state 仅用于 `inferImagePromptFromProduct`（文本反推），**不传给** `generateProductImageFromPrompt`。
- `generateProductImageFromPrompt`（`app/products/actions.ts`）只传 `prompt` 字符串到 `runCreditAiTask`，参考图信息完全丢失。

**🔴 核心问题 4 — `referenceImage` 参数在 `/api/ai/generate` 中存在但从未被前端调用**:

- **文件**: `app/api/ai/generate/route.ts` (行 19)
```typescript
const referenceImage = String(body.referenceImage || "").trim() || undefined;
const result = await generateImage({ prompt, userId: user.id, referenceImage });
```
- **问题**: 这个路由正确接收并传递了 `referenceImage`，但前端 `AiStudioClient.tsx` 的 `AssetAiPanel` **不发送 referenceImage**。该面板只有文本 prompt 输入。

### 3.3 修复建议

1. **切换到正确的 image-to-image API**:
   - 使用 DashScope 图像编辑 API `/api/v1/services/aigc/image2image/image-synthesis`
   - 或使用通义万相文生图 API 配合 `ref_img` 参数
   - 参考: https://help.aliyun.com/zh/dashscope/developer-reference/image-generation

2. **在 `runCreditAiTask` 中传递 referenceImage**:
   - 修改 `lib/services/ai.ts` 的 `runCreditAiTask` 签名，增加 `referenceImage?: string` 参数
   - 传递给 `generateImage({ prompt, userId, referenceImage })`

3. **在 `generateProductImageFromPrompt` action 中传递参考图**:
   - 修改 `app/products/actions.ts`，接收 `referenceImageUrl` 参数
   - 传递给 `runCreditAiTask`

4. **在前端面板中连接参考图到生成流程**:
   - `AiGeneratedImagePanel.tsx` 的"用提示词生图"按钮应传递 `referenceImage` state

---

## 4. 搜索持久化分析

### 4.1 sessionStorage 使用位置

**Ozon 调研控制台**:
- **文件**: `components/OzonResearchConsole.tsx`
  - `sessionStorage.getItem("ozon_products")` — 缓存市场搜索结果
  - `sessionStorage.setItem("ozon_products", ...)` — 写入搜索结果
  - `sessionStorage.setItem("ozon_task", ...)` — 缓存异步任务 ID

**1688 调研控制台**:
- **文件**: `components/Research1688Console.tsx`
  - `sessionStorage.getItem("rc_search")` / `setItem("rc_search", ...)` — 搜索关键词
  - `sessionStorage.getItem("rc_products")` / `setItem("rc_products", ...)` — 搜索结果

**任务轮询器**:
- **文件**: `components/ResearchTaskPoller.tsx`
  - `sessionStorage.setItem("ozon_research_task", ...)` — 任务恢复信息

### 4.2 边界问题分析

**🔴 问题 1 — 无 sessionStorage 容量限制**:

- **文件**: `components/OzonResearchConsole.tsx` (行 131)
```typescript
if (marketProducts.length > 0) { 
  sessionStorage.setItem("ozon_products", JSON.stringify(marketProducts)); 
}
```
- **问题**: `sessionStorage` 通常限制为 5MB。如果搜索返回大量商品（含图片 URL、描述等），JSON 序列化后可能超限。
- **影响**: `setItem` 抛出 `QuotaExceededError`，未被 try-catch 包裹，会导致 React 组件崩溃。
- **建议**: 用 try-catch 包裹，超限时只保留前 N 条或降级为不缓存。

**🔴 问题 2 — OzonResearchConsole 的 sessionStorage 读取在 SSR 期间不安全**:

- **文件**: `components/OzonResearchConsole.tsx` (行 123-127)
```typescript
const [savedMarketProducts, setSavedMarketProducts] = useState<any[]>(() => {
  if (typeof window !== "undefined") {
    try { return JSON.parse(sessionStorage.getItem("ozon_products") || "[]"); } catch { return []; }
  }
  return [];
});
```
- **问题**: 虽然有 `typeof window !== "undefined"` 检查，但 useState 初始化函数在 hydration 时执行。如果服务端渲染返回 `[]`，而客户端从 sessionStorage 读到数据，会导致 **hydration mismatch**。
- **影响**: React 控制台报 hydration warning，严重时 UI 不一致。

**🟡 问题 3 — Research1688Console 读取时序问题**:

- **文件**: `components/Research1688Console.tsx` (行 30, 39)
```typescript
const [searchKeyword, setSearchKeyword] = useState(() => {
  if (typeof window !== "undefined") return sessionStorage.getItem("rc_search") || "";
  return "";
});
```
- **问题**: 同样的 hydration mismatch 风险。且 `searchKeyword` 初始值来自 sessionStorage，但搜索结果 `products` 也从 sessionStorage 恢复，两者可能不同步（关键词已恢复但搜索结果已被清空）。

**🟡 问题 4 — OzonResearchConsole 中 "ozon_task" 只写不读**:

- **文件**: `components/OzonResearchConsole.tsx` (行 134)
```typescript
if (pendingTaskId) sessionStorage.setItem("ozon_task", JSON.stringify({...}));
```
- **问题**: 写入 `ozon_task` 但从未读取。`ResearchTaskPoller.tsx` 也只写入 `ozon_research_task`（不同 key），也不读取。
- **影响**: 持久化的任务信息从未被使用来恢复轮询状态。导航返回后无法恢复进行中的任务轮询。

**🟡 问题 5 — sessionStorage 数据不随用户切换清理**:

- **问题**: 用户 A 登录搜索后登出，用户 B 登录后会在 OzonResearchConsole 中看到用户 A 的搜索结果缓存。
- **影响**: 数据泄露风险（跨用户）。
- **建议**: 在 `clearSession()` (logout) 时清理 sessionStorage，或使用用户 ID 作为 key 前缀。

**🟡 问题 6 — Research1688Console 重复写入 sessionStorage**:

- **文件**: `components/Research1688Console.tsx` (行 48-49, 90)
```typescript
useEffect(() => { sessionStorage.setItem("rc_products", JSON.stringify(products)); }, [products]);
// ... 在 handleSearch 中又手动写一次:
sessionStorage.setItem("rc_products", JSON.stringify(data.products));
```
- **问题**: `useEffect` 已监听 `products` 变化自动写入，`handleSearch` 中又手动写入一次，造成冗余。虽然功能正确但增加出错面。

---

## 5. 数据库 Schema 完整性

### 5.1 现有模型（13 个）

| 模型 | 用途 | 评价 |
|------|------|------|
| User | 用户 | ✅ 完整 |
| Session | 会话 | ✅ 完整 |
| AiCredits | AI 额度 | ✅ 完整 |
| Store | Ozon 店铺 | ✅ 完整 |
| Product | 商品 | 🟡 缺库存字段 |
| SocialAccount | 社媒账号 | ✅ 完整 |
| SocialPost | 社媒内容 | ✅ 完整 |
| CustomerMessage | 客服消息 | ✅ 完整 |
| TaskLog | 任务日志 | ✅ 完整 |
| AdminActionLog | 管理操作 | ✅ 完整 |
| MarketSearchCache | 搜索缓存 | ✅ 完整 |
| ResearchTask | 调研任务 | ✅ 完整 |
| SourceProduct | 源商品 | ✅ 完整 |
| ApiIntegration | API 集成 | ✅ 完整 |

### 5.2 缺失的电商必需模型

**🔴 严重缺失**:

1. **Order / OrderItem** — 订单管理
   - 当前：订单数据仅作为 TaskLog.metadata JSON 存在
   - 需要：订单号、状态、金额、物流信息、买家信息、商品明细

2. **Payment / Subscription** — 支付与订阅
   - 当前：UserPlan 和 AiCredits 无付费获取路径
   - 需要：支付记录、订阅周期、发票

3. **Inventory / Stock** — 库存管理
   - 当前：Product 无库存字段
   - 需要：SKU、库存数量、预警阈值

4. **ProductVariant / SKU** — 商品变体
   - 当前：Product 无变体管理
   - 需要：颜色、尺寸、规格等变体维度

5. **Category** — 商品类目
   - 当前：类目映射硬编码在 `lib/services/ozon-market-categories.ts`
   - 需要：数据库存储的可管理类目树

**🟡 建议补充**:

6. **PriceRule** — 定价规则（汇率换算、利润率）
7. **Review** — 商品评价管理
8. **Logistics / Shipment** — 物流跟踪
9. **WebhookEvent** — Ozon webhook 事件记录

### 5.3 Product 模型字段缺失

```prisma
model Product {
  // ... 现有字段 ...
  // ❌ 缺少: stock        Int       @default(0)    // 库存
  // ❌ 缺少: sku          String?                   // SKU 编号
  // ❌ 缺少: barcode      String?                   // 条形码
  // ❌ 缺少: weight       Decimal?  @db.Decimal(8,3) // 重量
  // ❌ 缺少: dimensions   String?                   // 尺寸
  // ❌ 缺少: categoryId   String?                   // 类目关联
  // ❌ 缺少: costPrice    Decimal?  @db.Decimal(12,2) // 成本价
  // ❌ 缺少: ozonStatus   String?                   // Ozon 平台状态
}
```

---

## 6. 中间件和路由保护

### 6.1 Middleware 实现

**文件**: `middleware.ts`

```typescript
const protectedPrefixes = [
  "/admin", "/ai-studio", "/collector", "/content", "/credits",
  "/customer", "/dashboard", "/integrations", "/membership",
  "/products", "/research", "/settings", "/social", "/stores",
  "/tasks", "/help", "/pending", "/expired", "/suspended"
];
```

**✅ 正面**:
- 覆盖了所有业务页面路由 ✅
- 检查 session cookie 存在性 ✅
- 未登录用户重定向到 `/login` 并带 `next` 参数 ✅
- 已登录用户访问 `/login` `/register` 重定向到 `/dashboard` ✅

**🔴 严重问题 1 — Middleware 只检查 cookie 存在性，不验证有效性**:

```typescript
const hasSession = Boolean(request.cookies.get(sessionCookie)?.value);
```
- **问题**: 只检查 cookie 是否存在，不检查 token 是否有效、是否过期、是否对应数据库中的 session 记录。
- **影响**: 攻击者只需设置任意值的 `ozon_ops_session` cookie 即可通过 middleware 检查，进入受保护页面。虽然页面内的 server component / API 会调用 `requireApprovedUser()` 做二次验证，但 middleware 层的防护形同虚设。
- **建议**: middleware 中无法直接查数据库（Edge runtime），但可以验证 token 格式或使用 JWT 替代数据库 session。

**🔴 严重问题 2 — `/api` 路由完全不受 middleware 保护**:

- **问题**: `protectedPrefixes` 不包含 `/api`。
- **影响**: 所有 API 端点在 middleware 层完全开放。虽然每个 handler 内部有认证，但缺少纵深防御。
- **建议**: 添加 `"/api"` 到 protectedPrefixes，排除 `"/api/auth/login"` 和 `"/api/auth/register"`。

**🟡 中等 — `/factory` 路由未在保护列表中**:

- **问题**: `app/factory/` 目录存在页面（`page.tsx`, `[id]/page.tsx`, `drafts/page.tsx`），但 `/factory` 不在 `protectedPrefixes` 中。
- **影响**: 工厂工作台页面可能未受保护。需确认页面内部是否有认证。

**🟡 中等 — `/published` 路由未在保护列表中**:

- **问题**: `app/published/page.tsx` 存在，但 `/published` 不在 `protectedPrefixes` 中。

### 6.2 Admin 路由保护

**✅ 正面**: 
- `app/admin/actions.ts` 使用 `requireAdminUser()` ✅
- `app/admin/page.tsx` 等 admin 页面在 middleware 保护下 ✅

**🟡 中等**: Admin 页面在 middleware 层与普通用户页面同等对待，只在 server component / action 层面区分 admin 角色。如果某个 admin 页面遗漏了 `requireAdminUser()` 调用，普通用户可访问。

---

## 7. 依赖分析

### 7.1 生产依赖（8 个）

| 依赖 | 版本 | 评价 |
|------|------|------|
| next | ^14.2.16 | ✅ 最新 14.x |
| react / react-dom | ^18.3.1 | ✅ 稳定 |
| @prisma/client / prisma | ^5.22.0 | ✅ 稳定 |
| server-only | ^0.0.1 | ✅ 安全实践 |
| class-variance-authority | ^0.7.1 | ✅ |
| clsx | ^2.1.1 | ✅ |
| lucide-react | ^0.468.0 | ✅ |
| tailwind-merge | ^3.6.0 | ✅ |

### 7.2 开发依赖

| 依赖 | 版本 | 评价 |
|------|------|------|
| typescript | ^5.6.3 | ✅ |
| eslint / eslint-config-next | ^8.57.1 / ^14.2.16 | 🟡 eslint 8.x 即将 EOL |
| tailwindcss | ^3.4.15 | ✅ |
| embedded-postgres | ^18.3.0-beta.17 | 🟡 beta 版本，生产不建议 |
| @types/* | 适当版本 | ✅ |

### 7.3 缺失的关键依赖

**🔴 缺失**:
- **无输入验证库**: 所有 API route 手动用 `String(body.xxx || "")` 做类型转换，无 schema 验证。建议添加 `zod`。
- **无限流库**: 无 rate limiting，API 可被暴力调用。建议添加 `@upstash/ratelimit` 或中间件限流。
- **无日志库**: 使用 `console.info` / `console.error`，生产环境建议 `pino` 或 `winston`。
- **无安全 headers 库**: 无 `helmet` 或等效配置。
- **无 CSRF 库**: 无 `csurf` 或等效。

### 7.4 版本安全

- **Next.js 14.2.16**: 检查是否有已知 CVE。建议定期 `npm audit`。
- **embedded-postgres beta**: 仅用于开发环境，生产使用独立 PostgreSQL 实例 ✅（Dockerfile 未使用 embedded-postgres）。

---

## 8. 问题汇总与优先级

### 🔴 严重（P0 — 立即修复）

| # | 问题 | 文件位置 | 影响 |
|---|------|----------|------|
| 1 | API 路由不受 middleware 保护 | `middleware.ts` | 纵深防御缺失 |
| 2 | Middleware 只检查 cookie 存在性 | `middleware.ts:18` | 任意 cookie 可绕过 |
| 3 | 无 CSRF 防护 | 全局 | 状态变更 API 可被 CSRF |
| 4 | 图片代理 SSRF 漏洞 | `app/api/image-proxy/route.ts` | 内网探测 |
| 5 | AI 生图用错 API（多模态对话代替 image2image） | `lib/ai/provider.ts:84` | 生图匹配度差 |
| 6 | referenceImage 未传到生成 API | `lib/services/ai.ts:73` | 参考图无效 |
| 7 | 无 Order 数据模型 | `prisma/schema.prisma` | 订单无法管理 |
| 8 | 无支付集成 | 全局 | SaaS 商业模式缺失 |
| 9 | 无库存管理 | `prisma/schema.prisma` | 电商基础功能缺失 |
| 10 | 全局 AI_API_KEY 无用户隔离 | `lib/integrations.ts:168` | 额度可被滥用 |

### 🟡 中等（P1 — 尽快修复）

| # | 问题 | 文件位置 | 影响 |
|---|------|----------|------|
| 11 | .env 文件含真实密钥 | `.env` | 密钥泄露风险 |
| 12 | 加密密钥开发环境硬编码 | `lib/crypto.ts:14` | 开发环境加密无效 |
| 13 | 无 CORS 配置 | `next.config.mjs` | 未来跨域需求受阻 |
| 14 | Ozon 真实上传缺少 category/attributes | `lib/services/ozon.ts:283` | 上传会失败 |
| 15 | sessionStorage 无容量保护 | `OzonResearchConsole.tsx:131` | 大数据崩溃 |
| 16 | sessionStorage hydration mismatch | `OzonResearchConsole.tsx:123` | UI 不一致 |
| 17 | sessionStorage 不随用户切换清理 | 多组件 | 跨用户数据泄露 |
| 18 | `/factory` `/published` 路由未保护 | `middleware.ts` | 可能未认证访问 |
| 19 | 无输入验证库 | 全局 | 输入安全无保障 |
| 20 | 无限流机制 | 全局 | API 可被滥用 |
| 21 | Session 无并发控制 | `lib/auth.ts` | 无限 session |
| 22 | 任务持久化信息只写不读 | `OzonResearchConsole.tsx:134` | 功能不完整 |

### 🟢 低优先级（P2 — 计划修复）

| # | 问题 | 文件位置 |
|---|------|----------|
| 23 | eslint 8.x 即将 EOL | `package.json` |
| 24 | 图片代理 XSS 过滤不完整 | `app/api/image-proxy/route.ts:9` |
| 25 | Session 过期不主动清理 | `lib/auth.ts` |
| 26 | Research1688Console 重复写 sessionStorage | `Research1688Console.tsx:90` |
| 27 | 无日志库 | 全局 |
| 28 | 缺少 Product 字段（stock/sku/barcode等） | `prisma/schema.prisma` |
| 29 | 类目硬编码 | `lib/services/ozon-market-categories.ts` |

---

## 附录: 架构优点

尽管存在上述问题，项目在以下方面设计良好：

1. **密码安全**: scrypt + salt + timingSafeEqual，符合最佳实践 ✅
2. **密钥加密**: AES-256-GCM 加密存储 Ozon API Key ✅
3. **Session token 哈希**: 不存明文，SHA-256 哈希存储 ✅
4. **数据隔离**: 所有查询带 userId 过滤 ✅
5. **Prisma ORM**: 全程使用，无 SQL 注入风险 ✅
6. **Server-only 标记**: lib 函数正确使用 `import "server-only"` ✅
7. **商品生命周期**: 9 阶段状态机设计完整 ✅
8. **任务日志**: 所有操作记录 TaskLog，可审计 ✅
9. **Admin 审计**: AdminActionLog 记录管理员操作 ✅
10. **搜索缓存**: MarketSearchCache 减少 Apify 调用 ✅
11. **Apify 客户端**: 抽象良好，支持 retry/timeout/abort ✅
12. **`"use server"` / `"use client"` 正确分离**: Server Actions 和 Client Components 边界清晰 ✅

---

*报告结束*
