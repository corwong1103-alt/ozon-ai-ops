# SOURCE_MAPPING_AUDIT — OzonAI 商品源 ID 丢失审计

> 审计时间：2026-06-19 | 方法：只读诊断，未修改任何代码

---

## 一、受影响商品清单（13 件）

| # | ID | 标题（截取） | sourceProductId | offerId | 创建时间 | description 中有 ID? |
|---|-----|------------|:---:|:---:|------|------|
| 1 | cmqb24eno0005... | TAMA Percussion | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 2 | cmqb24ens0007... | Кофе Lavazza Tierra | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 3 | cmqb24enu0009... | Сыворотка Капиксил 10% | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 4 | cmqb24enw000b... | Guitar Combo Amp | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 5 | cmqb24enx000d... | Капиксил 5% | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 6 | cmqb24eny000f... | Wollmer Juicer | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 7 | cmqb24enz000h... | Guitar Combo Amp | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 8 | cmqb24eo0000j... | Guitar Combo Amp | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 9 | cmqb24eo4000l... | Hurom Juicer | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 10 | cmqb24eo7000n... | Hurom Juicer | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 11 | cmqb24eob000p... | Guitar Combo Amp | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 12 | cmqb24eod000r... | Кофе Lavazza Crema | NULL | NULL | 6/12 15:04 | ✅ 嵌入文本 |
| 13 | cmqb1lkzv0001... | Умная термобутылка | NULL | NULL | 6/12 14:49 | ❌ mock 创建 |

> 注：#13 是 mock research 创建的，从未走 Ozon API，description 中无 Product ID

---

## 二、根因分析

### 2.1 时间线

```
6/12 14:49  #13 创建 — mock research "加入商品池" → 无 Ozon ID
6/12 15:04  #1-#12 创建 — ozon-sync 路由 → status=discovered, 无 sourceProductId/offerId 列
6/18 白天   V3 重构 (041c003) → Prisma schema 新增 sourceProductId/offerId 列
6/18 晚间   迁移执行 → 新列以 NULL 填充已有行
```

### 2.2 代码层面

**V3 前（commit dfbbc6a）— 导致问题的版本：**

`app/api/stores/[id]/ozon-sync/route.ts`:
```typescript
const data = {
    userId: user.id,
    storeId: store.id,
    source: "ozon" as const,
    title: item.name,
    // ❌ 没有 sourceProductId
    // ❌ 没有 offerId
    description: [
        `Ozon Product ID: ${item.productId}`,   // ← ID 仅嵌入文本
        `Offer ID: ${item.offerId}`,             // ← ID 仅嵌入文本
        ...
    ].join("\n"),
    status: "discovered" as const                // ← 默认 discovered
};
```

**Prisma schema（dfbbc6a）**:
```prisma
model Product {
    // ❌ 没有 sourceProductId 列
    // ❌ 没有 offerId 列
    status ProductStatus @default(discovered)
}
```

**V3 后（commit 041c003）— 已修复但未回填：**

```typescript
const data = {
    ...
    sourceProductId: String(item.productId),  // ✅ 新增
    offerId: item.offerId,                    // ✅ 新增
    status: "in_product_center" as const      // ✅ 修复
};
```

```prisma
model Product {
    sourceProductId String?   // ✅ 新增（nullable）
    offerId     String?       // ✅ 新增（nullable）
}
```

### 2.3 结论：**数据库迁移历史遗留问题**

| 假说 | 验证结果 |
|------|---------|
| 数据库字段缺失 | ❌ 不成立 — V3 迁移已添加 sourceProductId/offerId（nullable） |
| 创建逻辑缺失 | ❌ 不成立 — 当前代码（041c003+）正确设置了这两个字段 |
| **迁移历史遗留** | ✅ **成立** — 12 件商品在字段添加前创建，迁移后未回填 |

### 2.4 数据可用性验证

12 件商品的 `description` 字段中均包含原始 ID：
```
Ozon Product ID: <数字>
Offer ID: <字符串>
```

这些 ID 可通过正则提取并回填到专用列。

---

## 三、创建商品的 3 条代码路径

### 路径 A：Ozon 店铺同步

| 项目 | 值 |
|------|-----|
| 文件 | `app/api/stores/[id]/ozon-sync/route.ts:33-80` |
| 触发 | `POST /api/stores/{id}/ozon-sync` → `mode=products` |
| 数据源 | `getOzonProductsForImport(store, 30)` → 真实 Ozon Seller API |
| 创建方式 | `prisma.product.create` / `prisma.product.update` |
| 当前 status | `in_product_center` |
| 当前 sourceProductId | ✅ `String(item.productId)` |
| 当前 offerId | ✅ `item.offerId` |

### 路径 B：Dashboard 一键全站测试

| 项目 | 值 |
|------|-----|
| 文件 | `app/dashboard/actions.ts:41-83` → `prepareFullSiteTest` |
| 触发 | 用户在 Dashboard 点击"全站测试准备" |
| 数据源 | `getOzonProductsForImport(store, 30)` |
| 创建方式 | `prisma.product.create` / `prisma.product.update` |
| 当前 status | `in_product_center` |
| 当前 sourceProductId | ✅ `String(item.productId)` |
| 当前 offerId | ✅ `item.offerId` |

### 路径 C：调研页手动入池

| 项目 | 值 |
|------|-----|
| 文件 | `app/research/actions.ts:19-113` → `addOzonProductToPool` |
| 触发 | 用户在调研页点击"加入商品池" |
| 数据源 | `getOzonProductsForImport(store, 50)` → 按 productId 匹配 |
| 创建方式 | `prisma.product.create` / `prisma.product.update` |
| 当前 status | `in_product_center` |
| 当前 sourceProductId | ✅ `String(ozonProduct.productId)` |
| 当前 offerId | ✅ `ozonProduct.offerId` |

### 路径 D：商品池手动创建

| 项目 | 值 |
|------|-----|
| 文件 | `app/products/actions.ts:28-48` → `createProduct` |
| 触发 | 商品池页"快速补录"表单 |
| 数据源 | 用户手动输入 |
| 当前 sourceProductId | ❌ 未设置（手动商品无源 ID） |
| 当前 offerId | ❌ 未设置 |

---

## 四、description 字段嵌入 ID 格式

每条 Ozon 同步商品的 `description` 字段格式：
```
Ozon Product ID: 123456
Offer ID: ABC-789
Currency: RUB
Image source: Ozon Seller API /v3/product/info/list
```

正则提取：
- `sourceProductId`：`/Ozon Product ID: (\d+)/` → 数字
- `offerId`：`/Offer ID: (.+)/` → 字符串（到行尾）

---

## 五、preparedFullSiteTest 为什么没回填成功

`prepareFullSiteTest` 的匹配查询：
```typescript
const existing = await prisma.product.findFirst({
    where: {
        userId: user.id,
        storeId: store.id,
        source: "ozon",
        description: { contains: `Ozon Product ID: ${item.productId}` }
    }
});
```

**失败原因**：`prepareFullSiteTest` 在 6/12、6/13、6/15 各执行了一次。每次执行时：
1. `getOzonProductsForImport` 调用真实 Ozon API `POST /v3/product/info/list`
2. 但 `normalizeOzonProduct` 提取 `productId: numberOrZero(item.id || item.product_id)`
3. 如果 Ozon API 返回的字段路径与预期不一致（例如 `product_id` 在 `items[].product_id` 而非顶层），则 `productId` 为 0
4. `String(0)` = `"0"` → 查询 `contains "Ozon Product ID: 0"` → 不匹配任何已有商品
5. `existing` = null → 走 create 而非 update → **创建了 0 件新商品**（因为 `getOzonProductsForImport` 可能返回空数组）

**证据**：6/15 的 `prepareFullSiteTest` task 记录"商品新增 0 / 更新 12"，但更新后的商品 `sourceProductId` 仍为 NULL。说明 update 路径虽然匹配了商品，但 data 中 `sourceProductId: String(item.productId)` 的 `item.productId` 为 0（即存储 `"0"` 而非真实 ID）。

**关键验证**：`normalizeOzonProduct`（`lib/services/ozon.ts:193-203`）：
```typescript
function normalizeOzonProduct(item: Record<string, unknown>): OzonProductImport {
    return {
        productId: numberOrZero(item.id || item.product_id),  // Ozon API /v3/product/info/list 返回的是 product_id
        offerId: String(item.offer_id || ""),
        ...
    };
}
```

Ozon API `/v3/product/info/list` 返回的 items 中字段为 `product_id`（snake_case）。`item.id || item.product_id` 如果 `item.id` 为 undefined 而 `item.product_id` 为数字，则返回正确值。但如果 Ozon API 版本返回的字段名略有不同（如 `id` vs `product_id`），可能提取失败。

**实际验证需要**：SSH 到线上 ECS 查 Ozon API 原始响应日志，确认字段名。本地无法复现（因为本地 Ozon API 走真实调用需要 valid credentials）。

---

## 六、最小修复方案

### 方案 A：SQL 回填（推荐，一次性）

```sql
-- 从 description 文本中提取 ID 并回填到专用列
UPDATE "Product"
SET "sourceProductId" = (
    SELECT (regexp_matches("description", 'Ozon Product ID: (\d+)'))[1]
),
"offerId" = (
    SELECT (regexp_matches("description", 'Offer ID: (.+)'))[1]
)
WHERE "source" = 'ozon'
  AND "sourceProductId" IS NULL
  AND "description" LIKE '%Ozon Product ID:%';
```

**优点**：不改代码，数据精确来源于已有文本  
**风险**：L1（只影响 12 行，事务可回滚）

### 方案 B：TypeScript 回填脚本

在 `scripts/backfill-source-ids.ts` 中：
```typescript
import { prisma } from "@/lib/prisma";

async function backfill() {
  const products = await prisma.product.findMany({
    where: { source: "ozon", sourceProductId: null }
  });
  
  for (const p of products) {
    const pidMatch = p.description.match(/Ozon Product ID: (\d+)/);
    const oidMatch = p.description.match(/Offer ID: (.+)/);
    if (pidMatch) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          sourceProductId: pidMatch[1],
          offerId: oidMatch?.[1] || null
        }
      });
    }
  }
  console.log(`Backfilled ${products.length} products`);
}
```

### 方案 C：重新同步

删除 12 件 `discovered` Ozon 商品，用当前代码重新从 Ozon API 同步。依赖于 Ozon API 可用 + `normalizeOzonProduct` 正确提取字段。

---

## 七、受影响但不限于此的其他商品

| 状态 | 数量 | 说明 |
|------|------|------|
| `discovered` + `source=ozon` + NULL | 12 | 本次审计焦点 |
| `optimizing` + `source=ozon` + NULL | 1 | mock 创建，从未有 Ozon ID |
| `discovered` + `source=ozon` + NULL | 1 | #15 重复 mock |

> 仅 `published` 的 1688 背包（cmqjmqfuz...）有完整 sourceProductId=offerId=`779353832297`

---

> **结论**：`sourceProductId` 和 `offerId` 丢失是 V3 Prisma 迁移的遗留问题——字段在数据创建之后才加入 schema。ID 数据仍存在于 `description` 文本字段中，可通过正则提取回填。推荐方案 A（SQL 直接回填）。
