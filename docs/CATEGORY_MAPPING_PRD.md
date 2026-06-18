# CATEGORY_MAPPING_PRD — Ozon 类目映射系统产品设计

> 版本：V1 | 日期：2026-06-19 | 前置审计：OZON_UPLOAD_AUDIT.md

---

## 一、问题陈述

当前 `ready_to_publish` 商品无法真实发布到 Ozon，因为：

1. **Product 表没有** `categoryId`、`attributes`（类目属性）、`vat`、`barcodes`、尺寸/重量
2. **uploadProductToOzon** 不生成这些字段
3. **没有类目选择 UI**，用户无法指定商品属于哪个 Ozon 类目
4. **没有属性填充机制**，类目属性（brand、material、volume 等）完全缺失
5. Ozon API `/v3/product/import` 会直接拒绝缺少 `category_id` + `attributes` 的请求

## 二、核心流程

```
Ozon 类目树 API (/v1/description-category/tree)
    ↓ 拉取 + 缓存
OzonCategory 表 (层级缓存，含类目名 + ID)
    ↓ 用户在商品详情页选择类目
Ozon 属性 API (/v1/description-category/attribute/{category_id})
    ↓ 拉取 + 缓存
OzonAttribute 表 (该类的属性模板：id、name、type、required、可选值)
    ↓ 用户在商品详情页填写属性值
Product.attributes (JSONB: [{id: 85, values: [{value: "Капиксил"}]}, ...])
    ↓ ready_to_publish 自动校验
PublishGuard: 检查 category_id + required attributes 是否填完
    ↓ 通过
uploadProductToOzon 发送完整 payload
```

## 三、用户故事

### US-1: 查看 Ozon 类目树
```
作为卖家，我希望在商品详情页看到一个可搜索的 Ozon 类目树，
以便选择我的商品正确类目。
```
- 首次访问时，系统后台拉取 Ozon 类目树并缓存 24h
- 用户可搜索关键词（如 "шампунь"），过滤匹配类目
- 选中后显示完整类目路径（如：Красота > Уход за волосами > Сыворотки）

### US-2: 查看类目属性模板
```
选择类目后，系统自动拉取该类目所需的属性列表，
包括必填属性（如 brand）和可选属性（如 hair_type）。
```
- 品牌 (brand) → 文本输入
- 产品类型 (product_type) → 下拉选择
- 容量 (volume) → 数字 + 单位
- 发质 (hair_type) → 多选

### US-3: 填写商品属性
```
在商品详情页的属性面板中填写 Ozon 类目属性，
系统实时校验必填项。
```
- 每个属性显示：名称、是否必填、输入类型、可选值
- 已填值持久化到 Product.attributes JSONB
- 必填未填时显示红色警告

### US-4: 发布前自动校验
```
ready_to_publish 状态时，PublishGuard 自动检查：
category_id 是否已选 + 所有必填属性是否已填。
```
- 全部通过 → 显示"可发布"绿色标识
- 有缺失 → 列出缺失字段，阻止发布

## 四、技术方案概览

### 新增 3 个 Prisma 模型

| 模型 | 作用 | 数据来源 |
|------|------|---------|
| `OzonCategory` | 缓存 Ozon 类目树 | `GET /v1/description-category/tree` |
| `OzonAttribute` | 缓存类目属性模板 | `GET /v1/description-category/attribute/{id}` |
| 扩展 `Product` | 新增 10 个发布字段 | 用户填写 + 系统导入 |

### 新增 2 个 API 路由

| 路由 | 作用 |
|------|------|
| `GET /api/ozon/categories` | 搜索/浏览 Ozon 类目树 |
| `GET /api/ozon/categories/[id]/attributes` | 获取指定类目的属性模板 |

### 新增 1 个组件

| 组件 | 作用 |
|------|------|
| `OzonCategoryPicker` | 类目树搜索 + 选择 + 属性填写面板 |

### 新增 1 个校验函数

| 函数 | 作用 |
|------|------|
| `validatePublishReadiness` | 检查 category_id + required attributes |

## 五、优先级

| P0 | P1 | P2 |
|----|----|-----|
| Product 扩展字段 | 类目树缓存 + 搜索 UI | 属性可选值翻译 |
| category_id + attributes 存储 | 属性模板拉取 + 填写 | barcodes 管理 |
| 发布前校验 guard | | 尺寸/重量字段 |
| vat 默认值 | | 历史商品批量补类目 |

## 六、不做什么（V1）

- 不自动推荐类目（AI 类目匹配 → V2）
- 不自动填充属性（AI 属性提取 → V2）
- 不做多类目（一个商品一个类目）
- 不做属性值翻译（假设卖家会俄语或用 AI 翻译 → 已有的 AI 能力可复用）
- 不实现 barcodes 管理（手动输入即可）

## 七、成功的标准

1. 商品详情页出现"Ozon 类目"区块
2. 用户可搜索并选择 Ozon 类目
3. 系统自动拉取该类目的属性模板
4. 用户填写属性后持久化到数据库
5. `ready_to_publish` 商品通过校验后可发布
6. `uploadProductToOzon` 发送包含 `category_id` + `attributes` 的完整 payload
