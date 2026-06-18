# SOURCE_MAPPING_FIX_REPORT — Ozon 商品源 ID 回填报告

> 执行时间：2026-06-19 | 状态：⏳ 脚本就绪，等待数据库启动

---

## 一、修复范围

| 项目 | 值 |
|------|-----|
| 受影响商品 | 12 件（`source=ozon` + `sourceProductId IS NULL`） |
| 修复方式 | 从 `description` 文本正则提取 ID 回填到专用列 |
| 额外跳过 | 1 件 mock 商品（cmqb1lkzv...）— description 中无 Ozon Product ID，保留 NULL |

---

## 二、修复原理

```
description 文本                              →  专用列
────────────────────────────────────────────    ───────────────
Ozon Product ID: 12345678                  →   sourceProductId = "12345678"
Offer ID: ABC-789                          →   offerId = "ABC-789"
Currency: RUB
Image source: Ozon Seller API /v3/product/info/list
```

正则提取：
- `sourceProductId` ← `/Ozon Product ID: (\d+)/` → 第一捕获组
- `offerId` ← `/Offer ID: (.+)/` → 第一捕获组（到行尾，trim）

---

## 三、执行文件

| 文件 | 用途 |
|------|------|
| `scripts/BACKUP_SOURCE_MAPPING.sql` | 回填前数据快照（临时表 + 恢复命令） |
| `scripts/backfill-source-ids.ts` | 主回填脚本（提取 → 更新 → 验证 → 抽样） |

---

## 四、执行命令

```bash
# 前置：确认 Docker PostgreSQL 运行中
# docker ps | grep postgres

# 1. 备份
cd ~/Documents/ozon
psql "$DATABASE_URL" -f scripts/BACKUP_SOURCE_MAPPING.sql

# 2. 回填（自动完成：提取 → 更新 → 验证 → 抽样）
npx tsx scripts/backfill-source-ids.ts
```

---

## 五、预期输出

```
=== Ozon 商品 sourceProductId / offerId 回填 ===

受影响商品：13 件

  ✅ cmqb24eno0005... | PID=12345678 | OID=ABC-789          | TAMA Percussion Instrument
  ...（12 行）
  ⏭ SKIP: Умная термобутылка с дисплеем температуры — description 中无 Product ID

预计修改：12 件（跳过 1 件）

执行回填...

已更新：12 件

=== 验证结果 ===
sourceProductId IS NULL: 0 ✅
offerId IS NULL:       1 ✅ (mock 商品无真实 Offer ID 属于正常)

=== 随机抽样验证（5 件）===
  Кофе Lavazza Tierra Selection 1 кг             | PID=12345678  | OID=ABC-789
  Сыворотка Капиксил 10%                         | PID=23456789  | OID=DEF-456
  ...
```

---

## 六、风险评估

| 维度 | 评级 | 说明 |
|------|------|------|
| 数据安全 | L1 | 仅更新 12 行，有备份，可回滚 |
| 逻辑正确性 | ✅ | ID 来自 description 文本（同一 API 响应写入），与真实 Ozon ID 一致 |
| 影响范围 | 局域 | 仅 `source=ozon` 且 `sourceProductId IS NULL` |
| 可逆性 | ✅ | 备份临时表 + 恢复 SQL 已就绪 |

---

## 七、回滚命令

```sql
UPDATE "Product" p SET
  "sourceProductId" = b."sourceProductId",
  "offerId" = b."offerId"
FROM _backup_ozon_products_20260619 b
WHERE p.id = b.id;
```

---

> **当前阻塞**：本地 PostgreSQL 未运行（Docker 容器已停止）。启动 Docker 后执行上述命令即可完成回填。
