# PRODUCT_PIPELINE_AUDIT — OzonAI V3 商品全链路阻塞审计

> 审计时间：2026-06-19 | 审计范围：本地数据库 16 商品 + 本地代码 | 方法：未修改任何代码，只读诊断

---

## 一、数据库商品全貌（16 件）

| # | ID 后缀 | 标题（截取） | 状态 | 来源 | 图 | storeId | srcProductId | offerId |
|---|---------|------------|------|------|-----|---------|-------------|---------|
| 1 | seed_prod..bottle | 316不锈钢保温杯 | **in_product_center** | manual | 0 | seed_store_growth | NULL | NULL |
| 2 | cmqb1lkzv... | Умная термобутылка | **optimizing** | ozon | 0 | NULL | NULL | NULL |
| 3 | cmqb24eno... | TAMA Percussion | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 4 | cmqb24ens... | Кофе Lavazza Tierra | discovered | ozon | 6 | cmqb1bzz6000 | NULL | NULL |
| 5 | cmqb24enu... | Сыворотка Капиксил 10% | discovered | ozon | 7 | cmqb1bzz6000 | NULL | NULL |
| 6 | cmqb24enw... | Guitar Combo Amp | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 7 | cmqb24enx... | Капиксил 5% | discovered | ozon | 8 | cmqb1bzz6000 | NULL | NULL |
| 8 | cmqb24eny... | Wollmer Juicer | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 9 | cmqb24enz... | Guitar Combo Amp | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 10 | cmqb24eo0... | Guitar Combo Amp | discovered | ozon | 9 | cmqb1bzz6000 | NULL | NULL |
| 11 | cmqb24eo4... | Hurom Juicer | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 12 | cmqb24eo7... | Hurom Juicer | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 13 | cmqb24eob... | Guitar Combo Amp | discovered | ozon | 0 | cmqb1bzz6000 | NULL | NULL |
| 14 | cmqb24eod... | Кофе Lavazza Crema | discovered | ozon | 5 | cmqb1bzz6000 | NULL | NULL |
| 15 | cmqb2eu4c... | Умная термобутылка(dup) | discovered | ozon | 0 | NULL | NULL | NULL |
| 16 | cmqjmqfuz... | Мужской рюкзак | **published** | source_1688 | 1 | local_dry_run_store | 779353832297 | 779353832297 |

**分布**：`discovered` 13（81%），`in_product_center` 1，`optimizing` 1，`published` 1

---

## 二、6 个阻塞点（按严重程度排序）

### 🔴 阻塞点 1：AI_PROVIDER 未设置为 dashscope → 所有 AI 产出为 mock 垃圾

**位置**：`lib/ai/provider.ts:25-27`
```typescript
function provider(): AiProvider {
  return process.env.AI_PROVIDER === "dashscope" ? "dashscope" : "mock";
}
```

**症状**：
- 当 `AI_PROVIDER` 不是 `"dashscope"` 时，`generateText()` 返回 `"mock AI：..."` 前缀文本
- `generateImage()` 返回 `{ url: "", provider: "mock" }`
- `optimizeProductMainFlow()` 虽然返回 `ok: true`，但优化后的内容是无效 mock 数据

**证据**：商品 `cmqb1lkzv...` 的 AI 图片生成 task 元数据：
```json
{ "url": "", "prompt": "...", "provider": "mock" }
```
百炼 DashScope integration 已配置（`status: configured`，`accountLabel: "百炼北京测试 Key"`），但 `.env` 中未设置 `AI_PROVIDER=dashscope`。

**后果**：即使走通整个流程（discovered → optimized → ready_to_publish → published），所有 AI 生成的标题/描述/图片都是 mock 数据，不能用于真实 Ozon 上架。

---

### 🔴 阻塞点 2：Ozon 同步的 12 件商品 sourceProductId 和 offerId 全部 NULL

**位置**：`app/api/stores/[id]/ozon-sync/route.ts:54-55`
```typescript
sourceProductId: String(item.productId),
offerId: item.offerId,
```

**症状**：12 件从 Ozon Store API 同步的商品，`sourceProductId` 和 `offerId` 全部为 NULL。

**可能根因**（需实测验证，未修改代码无法确认）：
1. Ozon API 返回的 `product_id` 字段为 `0` 或不存在 → `normalizeOzonProduct` 返回 `productId: 0` → `String(0)` = `"0"`，不应是 NULL
2. 可能性更高的根因：这 12 件商品是在 ozon-sync 代码完成前由旧版 mock 路径创建的，当时未设置这些字段
3. `prepareFullSiteTest` 更新时可能未正确匹配 `existing` 查询条件，导致字段未被更新

**后果**：
- 无法通过 ID 反查 Ozon 源商品
- 无法去重（同商品可能被重复导入）
- 无法验证商品来源真实性
- 重新同步时无法匹配已存在商品

---

### 🔴 阻塞点 3："加入商品池" 按钮跳过了 V3 9 阶段状态机的 3 个中间状态

**位置**：`components/ProductActionControls.tsx:136-138`
```typescript
if (action.intent === "optimize" || action.intent === "pool" || action.intent === "progress") {
    run(() => optimizeProductMainFlow(productId));
}
```

**症状**：对 `discovered` 状态商品点击"加入商品池"，直接触发 `optimizeProductMainFlow`，该函数：
1. 接受 `discovered` → 直接设 `optimizing`（跳过 `favorited`、`in_product_center`）
2. 调用 AI → 直接设 `optimized`（跳过中间检查）

**完整跳过的状态**：
- ❌ `favorited` — 收藏（从未使用）
- ❌ `in_product_center` — 已入商品中心（从未经过）
- ❌ `optimizing` — 瞬间经过，无进度反馈

**补充**：`optimizeProductMainFlow`（`app/products/actions.ts:164-205`）接受的合法输入是：
```typescript
["in_product_center", "favorited", "discovered", "optimizing"]
```
但它把 `discovered` 和 `in_product_center` 混在一起处理，没有语义区分。

**后果**：V3 精心设计的 9 阶段生命周期被架空 — 前端说 9 阶段，实际只有 3 跳（discovered → optimizing → optimized → ready_to_publish → published）。

---

### 🟡 阻塞点 4：discovered 状态商品在商品池页面完全不可见

**位置**：`app/products/page.tsx:11,41`
```typescript
const POOLED_STATUSES = ["in_product_center", "optimizing", "optimized",
                          "ready_to_publish", "published", "promoted"] as const;
// ...
where: { userId: user.id, status: { in: [...POOLED_STATUSES] } }
```

**症状**：13 件 `discovered` 商品不会出现在 `/products` 商品池页面。用户只能通过以下方式找到它们：
- Dashboard 首页（也过滤掉了 `discovered`，只显示 `in_product_center`+）
- 直接输入 URL `/products/<id>`

**验证**：Dashboard 页面同样过滤 `discovered`：
```typescript
// app/dashboard/page.tsx:61
status: { in: ["in_product_center", "optimizing", "optimized", "ready_to_publish"] }
```

**后果**：`discovered` 商品对用户来说是"幽灵商品" — 存在于数据库，但前台找不到入口。

---

### 🟡 阻塞点 5：1688 OpenAPI 5 次采集全部失败 — 缺少真实凭证

**位置**：`app/api/sources/1688/collect/route.ts` → `lib/services/source-1688-openapi.ts`

**症状**：6/18 晚间 5 次尝试 1688 采集，全部返回：
```
1688 OpenAPI 商品采集失败：1688 OpenAPI 未配置完整，请先填写 App Key、App Secret 和 Access Token。
```

**代码状态**：采集 API、HMAC-SHA1 签名、字段归一化代码已完成（23/23 单测 pass），但 `source_1688` integration 缺少：
- `appKey` — 阿里开放平台 App Key
- `appSecret` — App Secret（加密存储）
- `accessToken` — OAuth Access Token

---

### 🟢 阻塞点 6：唯一的 published 商品（1688 背包）第一次上架失败

**证据**：
```
Task 1 (cmqjmvkfp): upload failed — "未绑定或未选择 Ozon 店铺，上传失败。"
Task 2 (cmqjmw0nt): upload success — "模拟上架（dry-run）成功：... -> Local Dry-run Ozon Store"
```

**根因**：第一次调用 `uploadProduct` 时 `storeId` 为空。用户需要预先在 UI 选择店铺。这是 UX 问题而非逻辑 bug — 但说明当前流程要求用户先绑定店铺再商品，没有自动关联。

---

## 三、状态机流转图与代码映射

```
                           optimizeProductMainFlow()
                           ┌──────────────────────────┐
                           │ 跳过 favorited            │
                           │ 跳过 in_product_center    │
                           │ 瞬间 optimizing            │
                           │ → optimized               │
                           └──────────────────────────┘
                                    │
discovered ──→ in_product_center ──→ optimizing ──→ optimized ──→ ready_to_publish ──→ published
  (81%)          (6%)                 (6%)                              (0%)              (6%)
   │               │                    │         │         │               │                │
   │               │                    │         │         │               │                │
   │     createProduct()          translateProduct()  │  confirmProductReady()    uploadProduct()
   │     直接创建                  generateProductImage()   需要 optimized 状态       需要 storeId
   │     status:in_product_center optimizeProductMainFlow()
   │                                                       │
   │                                        getProductNextAction("optimized")
   │                                        → { intent: "confirm" }
   │
   │   getProductNextAction("discovered")
   │   → { intent: "pool" }
   │                │
   │                ▼
   │   ProductPrimaryAction.tsx:136
   │   intent==="pool" → optimizeProductMainFlow()
   │
   └─ 无独立 server action 可将 discovered → in_product_center
      只有 addOzonProductToPool / addOzonMarketProductToPool
      （仅在调研页调用，不在商品池或商品详情页暴露）
```

**每一步详细信息**：

| 步骤 | 触发方式 | 代码位置（action） | 代码位置（UI） | 数据库字段变化 | 前置条件 |
|------|---------|-------------------|---------------|---------------|---------|
| discovered → in_product_center | `addOzonProductToPool` / `addOzonMarketProductToPool` / `createProduct` | `app/research/actions.ts:19,129` / `app/products/actions.ts:28` | 调研页"加入商品池"按钮 / 手动创建表单 | `status` | Ozon Seller API 连通 / Apify 返回有效商品 |
| in_product_center → optimizing | `translateProduct` / `generateProductImage` / `optimizeProductMainFlow` | `app/products/actions.ts:123,301,164` | 商品详情页 AI 按钮 / "开始 AI 优化"主按钮 | `status` | AI_PROVIDER=dashscope（否则产出 mock） |
| optimizing → optimized | `optimizeProductMainFlow` 成功后自动 | `app/products/actions.ts:200` | 同上（异步完成） | `status` | AI 调用成功返回 |
| optimized → ready_to_publish | `confirmProductReady` | `app/products/actions.ts:207` | 商品详情页"人工确认"主按钮 | `status` | 前置状态必须是 `optimized` |
| ready_to_publish → published | `uploadProduct` | `app/products/actions.ts:444` | 商品详情页"发布到 Ozon"主按钮 + 选择店铺 | `status`, `storeId` | 必须选择 Ozon 店铺 |

---

## 四、选取 3 个真实候选商品

按图片数量、标题质量、来源真实性排序：

| 优先级 | ID | 标题 | 图数 | 入选理由 |
|--------|----|------|------|---------|
| ⭐1 | cmqb24ens... | Кофе Lavazza Tierra 1кг | 6 | 有 6 张真实 Ozon 图，快消品，标题完整 |
| ⭐2 | cmqb24enu... | Сыворотка Капиксил 10% | 7 | 有 7 张真实 Ozon 图，美妆高毛利品类 |
| ⭐3 | cmqb24eo0... | Guitar Combo Amplifier | 9 | 有 9 张真实 Ozon 图，但此商品被重复入池 5 次 |

**实际走查结果**（未执行，因 `AI_PROVIDER` 未设为 `dashscope` 且 `discovered` 商品在 UI 不可见，无法手动端到端走）：

| 步骤 | 商品 1 (Coffee) | 商品 2 (Serum) | 商品 3 (Guitar) |
|------|----------------|----------------|-----------------|
| 在商品池可见 | ❌ 状态为 discovered | ❌ 状态为 discovered | ❌ 状态为 discovered |
| 可通过 URL 直达 | ✅ /products/cmqb24ens... | ✅ /products/cmqb24enu... | ✅ /products/cmqb24eo0... |
| 点击"加入商品池" | ⚠️ 实际触发 optimizeProductMainFlow | ⚠️ 同上 | ⚠️ 同上 |
| AI 优化结果 | ❌ mock — 无俄语文案 | ❌ mock — 无俄语文案 | ❌ mock — 无俄语文案 |
| 人工确认 ⚠️ 无法到达 | 因为 AI 产出是 mock，不应确认 | 同上 | 同上 |

---

## 五、最小修复路径（不在此次审计范围，仅标注）

要打通一条真实商品全链路，按优先级需要：

1. **设置 `AI_PROVIDER=dashscope`** — 解除所有 AI mock，让翻译/优化/生图产出真实俄语文案和图片
2. **修复 discovered 商品在商品池不可见** — 将 `discovered` 加入 `POOLED_STATUSES`
3. **给 discovered → in_product_center 一个独立 server action** — 不要复用 `optimizeProductMainFlow`，让入池和 AI 优化解耦
4. **补全 Ozon 同步商品的 sourceProductId/offerId** — 查 Ozon API 原始响应，确认 `normalizeOzonProduct` 正确提取了字段
5. **获取 1688 OpenAPI 真实凭证** — 在阿里开放平台创建应用，获取 App Key/App Secret/Access Token

---

## 六、环境校验摘要

| 项目 | 本地值 | 线上值（47.239.96.230） |
|------|--------|------------------------|
| AI_PROVIDER | **未设置**（fallback mock） | 未知（需 SSH 检查） |
| Apify Token (ozon_market) | configured（seller 用户） | 未知 |
| dashscope | configured（百炼北京测试 Key） | 未知 |
| source_1688 | disconnected（缺凭证） | 未知 |
| Ozon 店铺 | 2 真实（4794980 + OZON-CB-90321）+ 2 mock | 4 店铺（含 2 真实） |
| 本地商品数 | 16 | 18 |
| 测试通过 | 23/23（1688 单测） | — |

---

> **结论**：当前阻塞不在"逻辑断了"，而在 **AI 产出为 mock** + **discovered 商品前端不可见** + **状态机被架空**。代码路径本身可以走通（1688 背包已证明 published 可达），但走出来的结果不是真实可用数据。
