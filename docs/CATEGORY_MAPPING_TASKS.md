# CATEGORY_MAPPING_TASKS — 实现任务拆分

> 版本：V1 | 日期：2026-06-19 | 预估总工期：2-3 会话

---

## Phase 1: 基础设施（1 会话）

### T1.1 — Prisma Schema 扩展

**文件**：`prisma/schema.prisma`

```
- 新增 OzonCategory 模型
- 新增 OzonAttribute 模型
- 新增 OzonAttributeValue 模型
- Product 新增 10 列：categoryId, ozonAttributes, ozonVat,
  ozonCurrencyCode, barcodes, depth, width, height, weight,
  dimensionUnit, weightUnit
```

**验证**：`npx prisma migrate dev` → 生成迁移 SQL → `npx prisma generate`

### T1.2 — Ozon 类目树同步脚本

**文件**：`scripts/sync-ozon-categories.ts`

```
1. 读取 Ozon store credentials（从 Store 表 + 解密）
2. POST /v1/description-category/tree → 获取全量类目树 JSON
3. 递归解析树结构 → 批量 upsert OzonCategory
4. 设置 expiresAt = now() + 24h
5. 日志输出：synced N categories, M leaf nodes
```

**验证**：`SELECT count(*) FROM "OzonCategory"` > 1000

### T1.3 — Ozon 类目 API 路由

**文件**：`app/api/ozon/categories/route.ts`

```
GET /api/ozon/categories?search=шампунь
→ 从 OzonCategory 表搜索匹配类目
→ 返回 { categories: [{id, title, path, level, isLeaf, childCount}] }

GET /api/ozon/categories?parentId=17033488
→ 返回子类目列表（用于树展开）
```

**验证**：curl API → 返回 JSON

---

## Phase 2: 属性系统（1 会话）

### T2.1 — 类目属性拉取函数

**文件**：`lib/services/ozon-category.ts`

```typescript
export async function getOrFetchCategory(categoryId: number)
export async function getOrFetchAttributes(categoryId: number)
export async function getOrFetchAttributeValues(attributeId: number, dictionaryId?: number)
```

**逻辑**：
1. 查本地 OzonAttribute 是否未过期
2. 过期 → 调 Ozon API 刷新
3. 返回属性列表（含 isRequired、type、可选值）

### T2.2 — 类目属性 API 路由

**文件**：`app/api/ozon/categories/[id]/attributes/route.ts`

```
GET /api/ozon/categories/17033489/attributes
→ 返回该类目所有属性模板
→ { attributes: [{id, name, type, isRequired, isCollection, values: [...]}] }

POST /api/products/[id]/category
→ Body: { categoryId: 17033489 }
→ 更新 product.categoryId
```

### T2.3 — 商品属性 CRUD API

**文件**：`app/api/products/[id]/attributes/route.ts`

```
PATCH /api/products/[id]/attributes
→ Body: { attributes: [{id: 85, values: [{value: "Капиксил"}]}] }
→ 更新 product.ozonAttributes
→ 校验必填属性

PATCH /api/products/[id]/publish-fields
→ Body: { vat, barcodes, depth, width, height, weight }
→ 更新对应字段
```

---

## Phase 3: 前端组件（1 会话）

### T3.1 — OzonCategoryPicker

**文件**：`components/OzonCategoryPicker.tsx`

```
┌─────────────────────────────────────────┐
│  Ozon 类目                            │
│  ┌───────────────────────────────────┐ │
│  │ 🔍 搜索类目...                    │ │
│  └───────────────────────────────────┘ │
│  📁 Красота и здоровье                │
│    📁 Уход за волосами (12)            │
│      📄 Шампуни                        │
│      📄 Кондиционеры                   │
│      📄 Сыворотки              ← 选中  │
│  ─────────────────────────────────────  │
│  已选: Красота > Уход > Сыворотки      │
│  ID: 17033489                          │
└─────────────────────────────────────────┘
```

**功能**：
- 搜索输入框 → 调 `GET /api/ozon/categories?search=`
- 树状展开/折叠 → 调 `GET /api/ozon/categories?parentId=`
- 只允许选择 `isLeaf=true` 的节点
- 选中后显示完整路径
- 保存按钮 → `POST /api/products/[id]/category`

### T3.2 — OzonAttributeForm

**文件**：`components/OzonAttributeForm.tsx`

```
┌─────────────────────────────────────────┐
│  Ozon 商品属性                         │
│  ─────────────────────────────────────  │
│  * Бренд                    [Капиксил] │
│  * Тип продукта   [Сыворотка для волос]│
│    Объем                     [30] (мл) │
│    Тип волос  ☑ Для всех  ☐ Жирные   │
│    Страна-изготовитель      [Китай]   │
│  ─────────────────────────────────────  │
│  * = 必填                            │
│  [保存属性]                            │
└─────────────────────────────────────────┘
```

**功能**：
- 根据 `categoryId` 拉取属性模板
- 根据 `type` 渲染不同输入控件（text/number/select/multi-select）
- `isRequired` 属性标记红色 *
- 保存按钮 → `PATCH /api/products/[id]/attributes`

### T3.3 — 集成到商品详情页

**文件**：`app/products/[id]/page.tsx`

在"模块 2 · 商品处理"下方新增"模块 2.5 · Ozon 类目与属性"区块：

```tsx
<section className="ledger-card p-5">
  <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 2.5 · Ozon 类目与属性</p>
  <OzonCategoryPicker productId={product.id} categoryId={product.categoryId} />
  {product.categoryId && (
    <OzonAttributeForm
      productId={product.id}
      categoryId={product.categoryId}
      savedAttributes={product.ozonAttributes}
    />
  )}
</section>
```

---

## Phase 4: 发布校验（1 会话）

### T4.1 — validatePublishReadiness

**文件**：`lib/services/publish-guard.ts`

```typescript
export async function validatePublishReadiness(productId: string): Promise<PublishCheckResult>
```

**检查项**：
1. `categoryId` 非空
2. 标题非空
3. 描述非空
4. 价格 > 0
5. images 数组非空
6. 从 OzonAttribute 表读取该类目的必填属性
7. 对比 product.ozonAttributes 是否全部覆盖

**返回**：
```typescript
{ ok: boolean; missing: string[]; warnings: string[] }
```

### T4.2 — 接入 confirmProductReady

**文件**：`app/products/actions.ts`

在 `confirmProductReady` 开头插入：

```typescript
const check = await validatePublishReadiness(productId);
if (!check.ok) {
  return {
    ok: false,
    message: `发布前校验未通过：${check.missing.join("、")}`
  };
}
```

### T4.3 — 接入 uploadProductToOzon

**文件**：`lib/services/ozon.ts:469`

将当前的简化 payload 替换为完整 payload：

```typescript
const response = await postOzon("/v3/product/import", credentials, {
  items: [{
    offer_id: product.offerId || product.sourceProductId || `ozonai_${Date.now()}`,
    name: product.title,
    category_id: product.categoryId,
    price: String(product.price),  // 或按 kopecks 转换
    currency_code: product.ozonCurrencyCode || "RUB",
    vat: product.ozonVat || "0.2",
    description: product.description,
    images: images.slice(0, 15),
    attributes: product.ozonAttributes,
    barcodes: product.barcodes || [],
    depth: product.depth,
    width: product.width,
    height: product.height,
    weight: product.weight,
    dimension_unit: product.dimensionUnit || "mm",
    weight_unit: product.weightUnit || "g"
  }]
});
```

---

## 任务依赖图

```
T1.1 (Schema)
  ├─→ T1.2 (类目同步) ──→ T1.3 (API)
  │                              └─→ T3.1 (UI 类目选择器)
  ├─→ T2.1 (属性拉取) ──→ T2.2 (属性 API)
  │                              └─→ T3.2 (UI 属性表单)
  ├─→ T2.3 (商品属性 CRUD) ──→ T3.3 (集成详情页)
  └─→ T4.1 (校验) ──→ T4.2 (confirmProductReady)
                      └─→ T4.3 (uploadProductToOzon)
```

---

## 验收清单

- [ ] `OzonCategory` 表有 > 1000 条类目数据
- [ ] 商品详情页可见类目搜索/选择器
- [ ] 选择类目后自动显示属性表单
- [ ] 填写属性可保存到 `Product.ozonAttributes`
- [ ] `ready_to_publish` 有缺失字段时 `confirmProductReady` 返回错误
- [ ] `uploadProductToOzon` 发送完整 attributes + category_id
- [ ] 真实 Ozon API 返回 200（或返回具体缺失字段的错误，而非"category_id 缺失"）
