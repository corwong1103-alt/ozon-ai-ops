# OZON_UPLOAD_AUDIT — Ozon 发布链路审计

> 审计时间：2026-06-19 | 方法：只读代码+数据库审计，未修改代码

---

## 一、发布代码路径

```
ready_to_publish 商品
    │
    ├─ UI: ProductPrimaryAction.tsx (intent === "publish")
    │   └─ 调用 uploadProduct(productId, formData)
    │       └─ app/products/actions.ts:469
    │
    ├─ REST API: POST /api/products/[id]/upload
    │   └─ app/api/products/[id]/upload/route.ts:9
    │
    └─ 核心: uploadProductToOzon()
        └─ lib/services/ozon.ts:432
            ├─ mode === "blocked"   → 上架前检查未通过
            ├─ mode === "dry-run"   → 模拟成功（默认）
            └─ mode === "real"      → POST /v3/product/create
```

### 代码文件清单

| 文件 | 函数 | 作用 |
|------|------|------|
| `lib/services/ozon.ts:432` | `uploadProductToOzon` | 核心上架逻辑 |
| `lib/services/ozon.ts:419` | `buildUploadChecklist` | 上架前 5 项检查 |
| `lib/services/ozon.ts:78` | `postOzon` | Ozon API HTTP 客户端 |
| `lib/services/ozon.ts:394` | `getOzonProductsForImport` | 读 Ozon 商品列表 |
| `lib/services/ozon.ts:363` | `probeOzonStore` | 探测店铺 API 连接 |
| `app/api/products/[id]/upload/route.ts` | `POST` | REST 上架端点 |
| `app/products/actions.ts:469` | `uploadProduct` | Server Action 上架 |
| `app/products/actions.ts:207` | `confirmProductReady` | optimized→ready_to_publish |
| `components/ProductActionControls.tsx` | `ProductPrimaryAction` | UI 发布按钮 |

---

## 二、上架前检查清单（当前 5 项）

`buildUploadChecklist` (`lib/services/ozon.ts:419-429`):

| # | 检查项 | 字段来源 | Product 表有对应列？ |
|---|--------|---------|---------------------|
| 1 | 商品标题 | `product.title` | ✅ |
| 2 | 俄文文案 | 标题/描述含 Cyrillic 字符 | ✅ (字符串内容) |
| 3 | 商品描述 | `product.description` | ✅ |
| 4 | 价格 > 0 | `product.price` | ✅ (Decimal) |
| 5 | 至少 1 张图 | `product.images` | ✅ (Json) |

---

## 三、Ozon API 真实上架必需字段 vs 当前数据库

根据 Ozon Seller API `/v3/product/import` 文档标准：

### items[] 顶层字段

| 字段 | 类型 | 必填 | 数据库中 | 状态 |
|------|------|------|---------|------|
| `offer_id` | string | ✅ 必填 | `Product.offerId` = "2197236843-q88n" | ✅ 有 |
| `name` | string | ✅ 必填 | `Product.title` = 俄语标题 | ✅ 有 |
| `category_id` | integer | ✅ 必填 | **无此列** | ❌ 缺失 |
| `price` | string | ✅ 必填 | `Product.price` = 1081.00 | ⚠️ 单位问题 |
| `currency_code` | string | ✅ 必填 | `Product.currency` = "CNY" | ❌ 应为 RUB |
| `vat` | string | ✅ 必填 | **无此列** | ❌ 缺失 |
| `description` | string | ⚠️ 类目相关 | `Product.description` | ✅ 有 |
| `images` | string[] | ✅ 必填 | `Product.images` = 9 张 | ✅ 有 |
| `barcodes` | string[] | ⚠️ 部分类目必填 | **无此列** | ❌ 缺失 |
| `depth` | integer | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |
| `width` | integer | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |
| `height` | integer | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |
| `weight` | integer | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |
| `dimension_unit` | string | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |
| `weight_unit` | string | ⚠️ FBS 必填 | **无此列** | ❌ 缺失 |

### items[].attributes[] 类目属性

| 字段 | 类型 | 必填 | 数据库中 | 状态 |
|------|------|------|---------|------|
| `id` | integer | ✅ 必填 | **无此列** | ❌ 缺失 |
| `values` | array | ✅ 必填 | **无此列** | ❌ 缺失 |

> attributes 是类目特定的属性数组。例如"美发产品"类目可能需要：`brand`（品牌）、`product_type`（产品类型）、`volume`（容量）、`hair_type`（发质）、`country_of_origin`（产地）等。每个属性有对应的 integer ID（来自 `/v1/description-category/attribute` API）。

---

## 四、当前 `uploadProductToOzon` 实际发送内容 vs 真实需求

### 当前代码发送（lib/services/ozon.ts:469-478）

```json
{
  "offer_id": "ozonai_1718700000000",
  "name": "Сыворотка...",
  "description": "Сыворотка для волос...",
  "price": 1081.00,
  "images": ["https://ir-2.ozonstatic.cn/...", ...]
}
```

### Ozon API 实际需要

```json
{
  "items": [{
    "offer_id": "2197236843-q88n",
    "name": "Сыворотка...",
    "category_id": 12345,              // ← 缺失：需查 Ozon 类目树
    "price": "1081.00",                // ← 当前是 number，需 string
    "currency_code": "RUB",            // ← 缺失：当前 CNY
    "vat": "0.2",                      // ← 缺失：俄罗斯增值税
    "description": "Сыворотка для волос...",
    "images": ["https://ir-2.ozonstatic.cn/...", ...],
    "attributes": [                     // ← 缺失：整个数组
      {
        "id": 85,                       // brand 属性 ID
        "values": [{"value": "Капиксил"}]
      },
      {
        "id": 8229,                     // product_type 属性 ID
        "values": [{"value": "Сыворотка для волос"}]
      }
    ],
    "barcodes": [],                     // ← 缺失：部分类目必需
    "depth": 30, "width": 30, "height": 120,   // ← 缺失：FBS 尺寸
    "weight": 50,                       // ← 缺失：克
    "dimension_unit": "mm",
    "weight_unit": "g"
  }]
}
```

---

## 五、验收商品（Капиксил 10%）距离成功发布还缺什么

### 已有

| 字段 | 值 | 状态 |
|------|-----|------|
| offer_id | `2197236843-q88n` | ✅ 从 Ozon 同步 |
| name | `Сыворотка для роста и густоты волос с Капиксилом 10%, для женщин, 30 мл` | ✅ 俄语 |
| description | 详细俄语文案（含成分、用法） | ✅ 俄语 |
| images | 9 张（8 Ozon 原图 + 1 AI 生成） | ✅ |
| 店铺 | `ozon测试` (ozonStoreId=4794980, ozonClientId=4794980) | ✅ API Key 已加密 |

### 缺失（5 项硬缺失 + 3 项可能缺失）

| # | 缺失字段 | 如何获取 | 严重度 |
|---|---------|---------|--------|
| 1 | `category_id` | 调 Ozon `/v1/description-category/tree` 查"美发产品"类目 ID | 🔴 必填 |
| 2 | `currency_code: "RUB"` | 数据库价格是 CNY，需按汇率转 RUB | 🔴 必填 |
| 3 | `vat` | 俄罗斯增值税率（通常 20% = `"0.2"`） | 🔴 必填 |
| 4 | `attributes[].id` + `values` | 调 `/v1/description-category/attribute/${category_id}` 获取类目属性列表，填 brand/brand_country/volume 等 | 🔴 必填 |
| 5 | `price` 类型 | 当前是 Decimal → 需转 string（"1081.00"）或转为 kopecks（整数分） | 🟡 格式问题 |
| 6 | `barcodes` | 如有商品条码则填，美妆类可能需要 | 🟡 类目相关 |
| 7 | 尺寸/重量 | FBS 发货模式需要物理尺寸 | 🟡 FBS 模式 |
| 8 | `offer_id` 生成策略 | 当前代码用 `ozonai_${Date.now()}` 覆盖了真实 offerId | 🔴 逻辑 bug |

---

## 六、代码缺陷

### 缺陷 1：使用 `/v3/product/create` 而非 `/v3/product/import`

`lib/services/ozon.ts:469`:
```typescript
const response = await postOzon("/v3/product/create", ...)
```

Ozon 标准 API 端点是 `/v3/product/import`。`/v3/product/create` 可能不存在或为旧版 API。

### 缺陷 2：offer_id 覆盖为随机值

```typescript
offer_id: `ozonai_${Date.now()}`,  // ← 丢弃了 product.offerId
```

应使用 `product.offerId` 或保留原始 Ozon SKU。

### 缺陷 3：price 为 number 而非 string

```typescript
price: Number(input.product.price),  // ← 1081.00 as number, not "1081.00"
```

Ozon API 期望 price 为 string（ISO 格式或 minor unit 整数）。

### 缺陷 4：价格单位为 CNY 而非 RUB

数据库 `product.currency = "CNY"`，但 Ozon 俄语站要求 RUB。需要：
- 获取 RUB/CNY 汇率
- 转换价格
- 或让卖家在 Ozon 后台配置价格策略

### 缺陷 5：完全缺失 category_id + attributes + vat + dimensions

这些字段在 `Product` 表中没有对应列，`uploadProductToOzon` 也不生成它们。

---

## 七、最小修复路径

### 数据库：新增发布字段

```sql
ALTER TABLE "Product"
  ADD COLUMN "categoryId" INTEGER,
  ADD COLUMN "ozonAttributes" JSONB DEFAULT '[]',
  ADD COLUMN "barcodes" JSONB DEFAULT '[]',
  ADD COLUMN "vat" TEXT DEFAULT '0.2',
  ADD COLUMN "currencyCode" TEXT DEFAULT 'RUB',
  ADD COLUMN "depth" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "weight" INTEGER;
```

### 代码：修复 uploadProductToOzon

```typescript
// 1. 改用 /v3/product/import
// 2. items 包装为数组
// 3. 加入 category_id、attributes、vat、currency_code
// 4. price 转 string 或 kopecks
// 5. offer_id 使用 product.offerId 或 sourceProductId
// 6. 加上尺寸/重量（如有）
```

### 运营：获取类目数据

```bash
# 获取美发产品类目树
GET /v1/description-category/tree

# 获取该类目属性
GET /v1/description-category/attribute/{category_id}

# 获取属性可选值
GET /v1/description-category/attribute/{category_id}/values
```

---

## 八、店铺 API 连接状态

| 店铺 | ozonStoreId | API Key | 最近探测 |
|------|-------------|---------|---------|
| ozon测试 | 4794980 | ✅ ENCRYPTED | 未知 |
| Ozon Growth Store | OZON-CB-90321 | ✅ ENCRYPTED (mock) | mock 店铺 |

---

> **结论**：当前系统可以走完 discovered → ready_to_publish 全链路，但 ready_to_publish → published (真实 Ozon 上架) 还差 **5 个硬缺失字段**（category_id、currency_code、vat、attributes、正确的 API 端点）和 **1 个逻辑 bug**（offer_id 被覆盖）。这些字段在 Product 表中没有列，uploadProductToOzon 也不尝试生成它们。需要数据库扩展 + API 修复 + 类目树查询三管齐下。
