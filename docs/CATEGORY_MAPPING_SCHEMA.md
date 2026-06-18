# CATEGORY_MAPPING_SCHEMA — 数据结构设计

> 版本：V1 | 日期：2026-06-19 | 基于 Prisma + PostgreSQL

---

## 一、现状：Product 表（15 列）

```prisma
model Product {
  id               String        @id @default(cuid())
  userId           String
  storeId          String?
  source           ProductSource @default(manual)
  sourceProductId  String?
  offerId          String?
  researchKeyword  String?
  title            String
  description      String
  price            Decimal       @db.Decimal(12, 2)
  currency         String        @default("CNY")
  images           Json          @default("[]")
  status           ProductStatus @default(discovered)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
}
```

### 缺失字段对照 Ozon API 需求

| Ozon API 字段 | 类型 | 必填 | Product 有？ |
|--------------|------|------|-------------|
| `offer_id` | string | ✅ | ✅ `offerId` |
| `name` | string | ✅ | ✅ `title` |
| `category_id` | integer | ✅ | ❌ |
| `price` | string | ✅ | ⚠️ Decimal→需转 |
| `currency_code` | string | ✅ | ⚠️ CNY→需 RUB |
| `vat` | string | ✅ | ❌ |
| `description` | string | - | ✅ `description` |
| `images` | string[] | ✅ | ✅ `images` |
| `attributes` | Array<{id, values}> | ✅ | ❌ |
| `barcodes` | string[] | - | ❌ |
| `depth/width/height` | integer | FBS | ❌ |
| `weight` | integer | FBS | ❌ |
| `dimension_unit` | string | FBS | ❌ |
| `weight_unit` | string | FBS | ❌ |

---

## 二、新增模型

### 2.1 OzonCategory — 类目树缓存

```prisma
model OzonCategory {
  id              Int            @id
  parentId        Int?
  parent          OzonCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
  children        OzonCategory[] @relation("CategoryTree")
  title           String         // 俄语类目名
  titleCn         String?        // 中文翻译（AI 翻译或手动）
  level           Int            @default(0)   // 层级深度（根=0）
  path            String?        // 面包屑路径 "Красота > Уход > Сыворотки"
  isLeaf          Boolean        @default(false) // 是否叶子节点（可发布到此类目）
  childCount      Int            @default(0)
  fetchedAt       DateTime       @default(now())
  expiresAt       DateTime                      // TTL 24h

  @@index([parentId])
  @@index([isLeaf])
  @@index([title])
}
```

**数据来源**：`GET /v1/description-category/tree` → Ozon 返回完整类目树 JSON → 递归存入

**示例数据**：
```
id=17033489, title="Сыворотки для волос", level=3, isLeaf=true
  parentId=17033488, title="Уход за волосами", level=2
    parentId=17033480, title="Красота и здоровье", level=1
      parentId=null, title="ROOT", level=0
```

### 2.2 OzonAttribute — 类目属性模板缓存

```prisma
model OzonAttribute {
  id              Int            @id       // Ozon 属性 ID（如 85 = brand）
  categoryId      Int
  category        OzonCategory   @relation(fields: [categoryId], references: [id])
  name            String         // 属性俄语名称
  description     String?        // 属性说明
  type            String         // "string" | "number" | "enum" | "boolean" | "dict"
  isRequired      Boolean        @default(false)
  isCollection    Boolean        @default(false) // 是否可多选
  groupName       String?        // 属性分组（如 "Основные", "Габариты"）
  dictionaryId    Int?           // 字典 ID（当 type=dict 时，需调用 /values 获取可选值）
  maxValueCount   Int?           // 最大可选值数量
  fetchedAt       DateTime       @default(now())
  expiresAt       DateTime                     // TTL 24h

  @@unique([categoryId, id])
  @@index([categoryId])
  @@index([isRequired])
}
```

**数据来源**：`GET /v1/description-category/attribute/{category_id}` → 属性列表 JSON → 存入

**示例数据**（Сыворотки для волос, categoryId=17033489）：
```
id=85,   name="Бренд",              type="string",  isRequired=true
id=8229, name="Тип продукта",       type="enum",    isRequired=true
id=9042, name="Объем",              type="number",  isRequired=false
id=4193, name="Тип волос",          type="enum",    isRequired=false, isCollection=true
id=4385, name="Страна-изготовитель", type="dict",    isRequired=false
```

### 2.3 OzonAttributeValue — 属性可选值缓存

```prisma
model OzonAttributeValue {
  id            Int            @id
  attributeId   Int
  attribute     OzonAttribute  @relation(fields: [attributeId], references: [id])
  value         String         // 可选值俄语
  valueCn       String?        // 中文翻译
  fetchedAt     DateTime       @default(now())

  @@index([attributeId])
}
```

**数据来源**：`GET /v1/description-category/attribute/{category_id}/values` 或 `/v1/dictionary/{dictionary_id}`

---

## 三、扩展 Product 表

```prisma
model Product {
  // ... 现有 15 列保持不变 ...

  // ── 新增：Ozon 发布字段 ──
  categoryId        Int?                          // Ozon 类目 ID → OzonCategory.id
  category          OzonCategory?   @relation(fields: [categoryId], references: [id])
  ozonAttributes    Json            @default("[]") // [{id: 85, values: [{value: "Капиксил"}]}, ...]
  ozonVat           String          @default("0.2") // "0" | "0.1" | "0.2" | "0.3" | "0.4"
  ozonCurrencyCode  String          @default("RUB") // 发布货币（Ozon 俄语站固定 RUB）
  barcodes          Json            @default("[]") // ["4601234567890"]
  depth             Int?                            // mm
  width             Int?                            // mm
  height            Int?                            // mm
  weight            Int?                            // g
  dimensionUnit     String          @default("mm")
  weightUnit        String          @default("g")

  @@index([categoryId])
}
```

### 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `categoryId` | Int? | NULL | 指向 OzonCategory.id，NULL = 未选类目 |
| `ozonAttributes` | Json | `[]` | 类目属性值数组，与 Ozon API items[].attributes 格式一致 |
| `ozonVat` | String | `"0.2"` | 俄罗斯增值税率，默认 20% |
| `ozonCurrencyCode` | String | `"RUB"` | Ozon 俄语站固定 RUB |
| `barcodes` | Json | `[]` | 商品条码数组 |
| `depth/width/height` | Int? | NULL | 物理尺寸（mm），NULL = 未填写 |
| `weight` | Int? | NULL | 重量（g），NULL = 未填写 |
| `dimensionUnit` | String | `"mm"` | 尺寸单位 |
| `weightUnit` | String | `"g"` | 重量单位 |

### ozonAttributes 数据格式

```json
[
  {
    "id": 85,
    "values": [
      {"value": "Капиксил"}
    ]
  },
  {
    "id": 8229,
    "values": [
      {"value": "Сыворотка для роста волос"}
    ]
  },
  {
    "id": 9042,
    "values": [
      {"value": "30"}
    ]
  },
  {
    "id": 4193,
    "values": [
      {"value": "Для всех типов волос"},
      {"value": "Для жирных волос"}
    ]
  }
]
```

---

## 四、完整 Prisma Schema 变更

```diff
+ model OzonCategory {
+   id         Int            @id
+   parentId   Int?
+   parent     OzonCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
+   children   OzonCategory[] @relation("CategoryTree")
+   title      String
+   titleCn    String?
+   level      Int            @default(0)
+   path       String?
+   isLeaf     Boolean        @default(false)
+   childCount Int            @default(0)
+   fetchedAt  DateTime       @default(now())
+   expiresAt  DateTime
+
+   attributes OzonAttribute[]
+   products   Product[]
+
+   @@index([parentId])
+   @@index([isLeaf])
+   @@index([title])
+ }
+
+ model OzonAttribute {
+   id            Int            @id
+   categoryId    Int
+   category      OzonCategory   @relation(fields: [categoryId], references: [id])
+   name          String
+   description   String?
+   type          String
+   isRequired    Boolean        @default(false)
+   isCollection  Boolean        @default(false)
+   groupName     String?
+   dictionaryId  Int?
+   maxValueCount Int?
+   fetchedAt     DateTime       @default(now())
+   expiresAt     DateTime
+
+   values        OzonAttributeValue[]
+
+   @@unique([categoryId, id])
+   @@index([categoryId])
+   @@index([isRequired])
+ }
+
+ model OzonAttributeValue {
+   id          Int            @id
+   attributeId Int
+   attribute   OzonAttribute  @relation(fields: [attributeId], references: [id])
+   value       String
+   valueCn     String?
+   fetchedAt   DateTime       @default(now())
+
+   @@index([attributeId])
+ }

  model Product {
    // ... existing 15 fields ...

+   categoryId       Int?
+   category         OzonCategory?   @relation(fields: [categoryId], references: [id])
+   ozonAttributes   Json            @default("[]")
+   ozonVat          String          @default("0.2")
+   ozonCurrencyCode String          @default("RUB")
+   barcodes         Json            @default("[]")
+   depth            Int?
+   width            Int?
+   height           Int?
+   weight           Int?
+   dimensionUnit    String          @default("mm")
+   weightUnit       String          @default("g")

+   @@index([categoryId])
  }
```

---

## 五、校验规则

### PublishGuard（ready_to_publish 前校验）

```typescript
function validatePublishReadiness(product): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!product.categoryId) missing.push("category_id — 未选择 Ozon 类目");
  if (!product.title) missing.push("name — 标题为空");
  if (!product.description) missing.push("description — 描述为空");
  if (Number(product.price) <= 0) missing.push("price — 价格无效");

  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length === 0) missing.push("images — 至少需要 1 张图");

  // 校验必填类目属性
  const requiredAttrs = product.categoryId
    ? await getRequiredAttributes(product.categoryId)
    : [];
  const filledAttrIds = (product.ozonAttributes as any[] || [])
    .filter(a => a.values?.length > 0)
    .map(a => a.id);

  for (const attr of requiredAttrs) {
    if (!filledAttrIds.includes(attr.id)) {
      missing.push(`attributes.${attr.id} — ${attr.name}（必填）`);
    }
  }

  return { ok: missing.length === 0, missing };
}
```

---

## 六、缓存策略

| 数据 | TTL | 刷新策略 |
|------|-----|---------|
| OzonCategory（类目树） | 24h | 任何人访问时如果过期自动刷新 |
| OzonAttribute（属性模板） | 24h | 选择类目时如果过期自动刷新 |
| OzonAttributeValue（可选值） | 24h | 和属性模板一起刷新 |

过期判断：`expiresAt < now()` → 重新调 Ozon API → upsert

---

## 七、迁移计划

```
1. prisma migrate dev --name add_ozon_category_system
   创建 OzonCategory / OzonAttribute / OzonAttributeValue
   扩展 Product 新增 10 列

2. scripts/sync-ozon-category-tree.ts
   首次拉取 Ozon 全量类目树 → 写入 OzonCategory

3. 商品详情页新增 OzonCategoryPicker 组件
   搜索/选择类目 → 保存 categoryId

4. 属性面板自动拉取
   选择类目后 → GET /api/ozon/categories/[id]/attributes → 渲染属性表单

5. PublishGuard 上线
   校验函数接入 confirmProductReady / uploadProduct / upload API
```
