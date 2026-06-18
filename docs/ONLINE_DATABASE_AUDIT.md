# ONLINE_DATABASE_AUDIT — OzonAI 线上数据库状态

> 审计时间：2026-06-19 | 方式：SSH 到 47.239.96.230 只读查询

---

## 一、DATABASE_URL 来源与读取顺序

### 配置层级

| 优先级 | 文件 | 位置 | 内容 |
|--------|------|------|------|
| 1 | `.env` | `~/Documents/ozon/.env` (本地) | `postgresql://postgres:postgres@localhost:5433/ozon_ai_ops` |
| 2 | `.env.production` | `/opt/ozon-ai/.env.production` (线上) | `postgresql://ozon:***@postgres:5432/ozon_ai_ops` |
| 3 | `docker-compose.yml` | 本地 & 线上 `docker-compose.yml` | 引用 `.env.production` 作为 env_file |

### 实际读取路径

```
本地 dev:
  npm run dev → .env → postgresql://postgres:postgres@localhost:5433/ozon_ai_ops

线上 production (Docker Compose):
  docker compose up → .env.production → postgresql://ozon:***@postgres:5432/ozon_ai_ops
                       ↑ Docker 内部 DNS：postgres → 容器 IP
```

### 两个数据库完全独立

| 维度 | 本地 | 线上 |
|------|------|------|
| 主机 | localhost:5433 | postgres:5432 (Docker 内网) |
| DB 名 | ozon_ai_ops | ozon_ai_ops |
| 用户 | postgres | ozon |
| 商品数 | 16 | **18** |
| 代码同步 | 本地 ahead（含 1688）| 线上 commit 041c003 |

---

## 二、线上数据库确认

| 项目 | 值 |
|------|-----|
| 服务器 | 47.239.96.230（阿里云香港 ECS） |
| 部署目录 | `/opt/ozon-ai/` |
| DB 引擎 | PostgreSQL 16 Alpine（Docker） |
| 连接方式 | Docker 内网 `postgres:5432` |
| 数据库名 | `ozon_ai_ops` |
| 当前部署 commit | `041c003`（V3 线上对齐） |

---

## 三、线上数据统计

### 商品总数：18 件

### 按状态分布

| 状态 | 来源 | 数量 |
|------|------|------|
| `discovered` | ozon | 11 |
| `discovered` | ozon_market | 2 |
| `discovered` | manual | 1 |
| `optimizing` | ozon | 3 |
| `optimizing` | ozon_market | 1 |
| **合计** | | **18** |

### 线上缺失的状态（0 件）

| 状态 | 线上 | 本地 |
|------|------|------|
| `in_product_center` | 0 | 1 |
| `optimized` | 0 | 0 |
| `ready_to_publish` | 0 | 0 |
| `published` | 0 | 1 |
| `promoted` | 0 | 0 |
| `archived` | 0 | 0 |

---

## 四、sourceProductId / offerId NULL 统计

| 条件 | 数量 |
|------|------|
| 总商品数 | **18** |
| `sourceProductId IS NULL` | **18**（100%）|
| `offerId IS NULL` | **18**（100%）|
| `source='ozon' AND sourceProductId IS NULL` | **14** |

### 按状态 x NULL 交叉

```
status       | source       | pid_null | oid_null | count
discovered   | ozon         | YES      | YES      | 11
discovered   | manual       | YES      | YES      | 1
discovered   | ozon_market  | YES      | YES      | 2
optimizing   | ozon         | YES      | YES      | 3
optimizing   | ozon_market  | YES      | YES      | 1
─────────────────────────────────────────────────────────
ALL 18 rows: pid_null=YES, oid_null=YES
```

> 线上比本地更严重：本地还有 1 件 1688 背包（published）有完整 ID，线上 0 件。

---

## 五、线上 vs 本地数据差异

| 差异点 | 本地 | 线上 |
|--------|------|------|
| 商品总数 | 16 | 18 |
| discovered | 13（含 1 mock）| 14（11 ozon + 2 market + 1 manual）|
| optimizing | 1 | 4 |
| in_product_center | 1（seed 保温杯）| 0 |
| published | 1（1688 背包，有 ID）| 0 |
| sourceProductId 非 NULL | 1 | 0 |
| offerId 非 NULL | 1 | 0 |
| 1688 代码 | ✅ commit 5b9a9c7 | ❌ 未部署（停在 041c003） |

---

## 六、P4 执行决策

### 结论：**需要在线上和本地各执行一次**

| 环境 | 需回填行数 | 阻塞点 |
|------|-----------|--------|
| 本地 | 12 行 | PostgreSQL 未运行（Docker 停止） |
| 线上 | 14 行（ozon）+ 2 行（ozon_market）= **16 行** | 无阻塞，可立即执行 |

### 线上执行命令

```bash
# P4 回填脚本需要在线上 Docker 容器中执行，因为线上 DB 不对外暴露端口
# 方案：SSH → docker compose exec app → npx tsx

ssh -i ~/.ssh/ozon_ai_hk_ed25519 root@47.239.96.230 \
  'cd /opt/ozon-ai && docker compose exec -T app npx tsx scripts/backfill-source-ids.ts'
```

### 前置条件

线上 P4 脚本 `scripts/backfill-source-ids.ts` 尚未部署到服务器。需要先 rsync 脚本（或直接在服务器上创建），然后执行。

---

## 七、关键发现

1. **线上 100% 商品缺失 sourceProductId 和 offerId**（18/18），本地也是 15/16 缺失
2. **线上没有任何商品走完 V3 全流程**：`in_product_center`、`optimized`、`ready_to_publish`、`published` 全部为 0
3. **1688 代码未部署到线上**（commit 5b9a9c7 仅在本地）
4. **两个数据库内容不同**：本地有 1688 背包测试数据，线上有更多 Ozon 同步数据
5. **ozon_market 商品同样缺失 ID**（线上 3 件），需要同样的 description 正则提取
