# OzonAI 总项目日志

> 导出日期：2026-06-17  
> 项目路径：`/Users/bigcor/Documents/ozon`  
> 项目状态：验证期 / MVP 功能完善中  
> 线上地址：`http://47.239.96.230`  
> 说明：本文档用于完整记录 OzonAI 项目的进展、产品内容、技术框架、部署状态、已完成模块、待完成模块和下一步路线。本文不记录任何真实 API Key、数据库密码、加密密钥或第三方 Token。

---

## 1. 项目定位

OzonAI 是一个面向 Ozon 跨境卖家的 AI 运营工作台，当前定位为私有化测试版 SaaS。项目目标不是先做公开平台，而是先围绕真实卖家工作流验证：

1. 绑定 Ozon 店铺 API。
2. 调研 Ozon 商品和市场数据。
3. 将可参考商品加入商品池。
4. 使用 AI 完成标题、描述、图片文案、商品图和社媒内容生成。
5. 在商品池中进行人工确认和编辑。
6. 未来再上传到 Ozon 店铺或进入社媒发布、客服回复等工作流。

当前核心验证方向：

- 选品逻辑是否可行。
- AI 辅助上架和翻译是否能提高效率。
- 商品图生成和社媒内容生成是否能形成实际运营价值。
- Ozon API、1688 数据源、VK/Wibus 社媒、客服助手和百炼大模型是否能串成完整流程。
- 香港 ECS 部署是否稳定，是否适合作为测试期服务器。

---

## 2. 当前产品逻辑

项目的主业务链路已经调整为：

```text
Ozon 调研 / 1688 采集
        ↓
真实商品图与商品信息进入商品池
        ↓
商品池编辑 / 图片管理 / AI 文案 / 翻译 / AI 生图
        ↓
确认商品资料
        ↓
模拟上传到 Ozon / 后续接真实上架 API
        ↓
社媒发布 / 客服助手 / 任务日志 / 额度管理
```

当前产品明确区分两类 Ozon 数据：

- `我的店铺 Seller API`：读取当前卖家绑定店铺中 Ozon Seller API 可见的商品、订单、仓库、权限等数据。
- `Ozon 全站市场搜索`：用于全 Ozon 范围商品搜索、类目搜索和热销 Top10-20，但必须接入真实市场数据源后才能返回结果。当前不会伪造全站搜索结果。

重要原则：

- 商品图必须来自真实链接返回的图片，不使用随机替代图。
- 未接真实接口的模块必须明确标注状态，不伪装为已完成。
- 管理员可以看到服务器、百炼、API 接入状态。
- 普通卖家后续不应看到百炼模型、服务器部署、内部 API 细节，只需要看到充值、额度和业务功能。

---

## 3. 技术框架

当前技术栈：

| 层级 | 技术 |
|---|---|
| 前端框架 | Next.js 14 App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + 自定义全局 CSS |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | Cookie Session + HTTP-only Cookie |
| 部署 | Docker Compose |
| 反向代理 | Nginx |
| 服务器 | 阿里云香港 ECS |
| AI Provider | 阿里云百炼 / DashScope |
| 图片代理 | `/api/image-proxy` |
| 密钥保存 | 数据库加密保存，不在页面明文显示 |

主要目录：

```text
app/                  Next.js 页面、API Routes、Server Actions
components/           页面组件与交互组件
lib/                  认证、Prisma、AI、Ozon、集成配置、图片工具
prisma/               数据模型、迁移、seed
deploy/nginx/         Nginx 配置示例
docs/                 项目文档、部署文档、上下文记录
tests/                单元测试
Dockerfile            生产镜像构建
docker-compose.yml    app + postgres 编排
```

---

## 4. 数据库模型

当前 Prisma 主要模型：

| 模型 | 作用 |
|---|---|
| `User` | 用户、角色、状态、套餐 |
| `Session` | 登录会话 |
| `AiCredits` | 图片和视频 AI 额度 |
| `Store` | Ozon 店铺 API 绑定信息 |
| `Product` | 商品池商品 |
| `SocialAccount` | 社媒账号状态 |
| `SocialPost` | 社媒发布内容 |
| `CustomerMessage` | 客服消息 |
| `TaskLog` | 所有业务动作日志 |
| `AdminActionLog` | 管理员操作日志 |
| `ApiIntegration` | 百炼、Ozon 市场、1688、VK、Wibus 等 API 接入配置 |

主要枚举：

```text
UserRole: user / admin
UserStatus: pending / approved / expired / suspended
UserPlan: starter / pro / vip
ProductSource: ozon / source_1688 / manual
ProductStatus: draft / translated / image_generated / video_generated / uploaded
IntegrationProvider: dashscope / ozon_market / source_1688 / vk / wibus
TaskType: collect / research / translate / image / video / upload / social_post / social_video / social_publish / customer_message / auto_reply / alert
TaskStatus: queued / processing / success / failed
```

---

## 5. 权限与账号体系

当前账号体系：

- 注册用户默认进入 `pending`。
- 管理员审核通过后，用户才能使用主系统。
- 过期用户进入 `/expired`。
- 暂停用户进入 `/suspended`。
- 待审核用户进入 `/pending`。
- 管理员页面需要 `role = admin`。

测试账号：

| 账号 | 角色 | 状态 |
|---|---|---|
| `admin@demo.com` | admin | approved / vip |
| `operator@demo.com` | user | approved |
| `pending@demo.com` | user | pending |

测试密码为项目 seed/demo 用途，不应作为正式生产密码长期使用。

---

## 6. 当前页面与功能模块

### 6.1 登录 / 注册

路径：

```text
/login
/register
```

已完成：

- 邮箱登录。
- 用户注册。
- 注册后进入待审核状态。
- Cookie session。
- 不同账号状态的跳转保护。

---

### 6.2 Dashboard

路径：

```text
/dashboard
```

已完成：

- 运营数据概览。
- 商品、任务、额度、API 接入、店铺状态等核心信息展示。
- UI 已从早期大图标展示，调整为更像运营工作台的数据化布局。
- 管理员可看到平台状态；后续普通卖家应隐藏服务器和百炼底层信息。

待继续：

- 继续减少冗余装饰，强化首屏重点数据。
- 普通卖家视角需要进一步产品化，只展示业务相关指标和充值入口。

---

### 6.3 Ozon 店铺

路径：

```text
/stores
/stores/new
```

已完成：

- 绑定 Ozon 店铺。
- 保存 Ozon Client ID、API Key、店铺备注。
- API Key 加密保存。
- 店铺页可测试：
  - 权限。
  - 仓库。
  - 商品。
  - 订单。
- 已接 Ozon Seller API 基础读取能力。

重要说明：

- 店铺 API 属于卖家后台 Seller API。
- Seller API 不等于 Ozon 前台市场搜索 API。

---

### 6.4 Ozon 调研

路径：

```text
/research/ozon
```

当前已拆分成两个模式：

#### Ozon 全站市场搜索

用途：

- 面向“全 Ozon 范围”的商品搜索。
- 支持类目选择。
- 支持关键词搜索。
- 目标是未来返回真实 Top10-20、评分、评论数、排名、卖家、商品图等信息。

当前状态：

- 页面和数据适配器已完成。
- API 接入中心已新增 `Ozon 市场搜索 / 热销榜数据源`。
- 未接真实市场数据源前，不返回假商品。
- 未接真实市场数据源时，页面明确显示“这里暂时不会放假数据”。

已预设类目：

| 类目 ID | 中文 | 俄文 |
|---|---|---|
| `beauty_hair` | 美妆个护 / 头发护理 | Красота / Уход за волосами |
| `beauty_skin` | 美妆个护 / 面部护理 | Красота / Уход за лицом |
| `home_kitchen` | 家居厨房 | Дом и кухня |
| `electronics` | 数码电子 | Электроника |
| `kids` | 母婴儿童 | Детские товары |
| `auto` | 汽车用品 | Автотовары |
| `fashion` | 服饰配件 | Одежда и аксессуары |
| `sports` | 运动户外 | Спорт и отдых |
| `pet` | 宠物用品 | Товары для животных |
| `tools` | 五金工具 | Инструменты |
| `health` | 健康护理 | Здоровье |

#### 我的店铺 Seller API

用途：

- 读取已绑定 Ozon 店铺 API 返回的真实商品。
- 真实商品图来自 `/v3/product/info/list`。
- 可以将商品加入商品池。

已完成：

- 店铺选择。
- 关键词筛选。
- 类目辅助筛选。
- 价格筛选。
- 只看有图。
- 有图优先 / 价格排序。
- 入池按钮带 toast 反馈。

限制：

- Seller API 只能看到当前店铺可访问的数据。
- 无法提供全 Ozon 前台热销榜、全平台搜索排名。

---

### 6.5 1688 采集

路径：

```text
/collector
```

当前状态：

- 页面保留为真实接入引导。
- 不再展示假的 1688 商品图。
- API 接入中心已有 `1688 / 阿里开放平台` 配置入口。

待完成：

- 接入真实 1688 商品链接采集。
- 或接入阿里开放平台授权 API。
- 采集结果进入商品池，并保留真实商品图链接。

---

### 6.6 商品池

路径：

```text
/products
/products/[id]
```

已完成：

- 商品池首页。
- 手动创建商品。
- 从 Ozon Seller API 商品入池。
- 从 Ozon 市场数据源商品入池的动作已预留并完成。
- 商品详情编辑。
- 标题、描述、价格、图片 URL 编辑。
- 商品图片预览。
- 图片删除、替换、排序。
- 拖动排序。
- 保存、翻译、生图、上传等按钮均有反馈。

商品详情页已形成当前核心工作台：

```text
商品基础信息编辑
        ↓
AI 操作按钮
        ↓
AI 生成参考区
        ↓
图片工作台
        ↓
上传到 Ozon
        ↓
任务状态
```

---

### 6.7 AI 生图工作流

当前路径：

```text
/products/[id]
```

已完成逻辑：

1. 商品原图展示。
2. 选择某张原商品图作为参考。
3. 点击 `参考原图反推提示词`。
4. 系统根据商品标题、描述、价格、参考图链接生成提示词。
5. 用户可手动编辑提示词。
6. 点击 `用提示词生图`。
7. 生图结果进入 `AI 生成参考区`。
8. 用户点击 `加入商品图` 后，才加入商品图片墙。

百炼生图接入状态：

- 文本模型测试已通过。
- AI 生图初期用 OpenAI compatible `/images/generations` 失败过。
- 后续已改为 DashScope native endpoint：

```text
https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

当前图片尺寸处理：

- 前端可填 `1024x1024`。
- 发送 DashScope native 时会转换为 `1024*1024`。

待继续：

- AI 生成图长期存储应接 OSS，避免临时链接或外部链接失效。
- 参考图反推目前使用文字模型和图片链接描述，不是真正视觉模型读图；若要真实视觉理解，需要接多模态视觉模型。

---

### 6.8 AI 文案 / 翻译

已完成：

- 商品标题/描述俄文翻译。
- 商品图文字俄文文案。
- 社媒文案生成。
- 客服回复建议。

费用逻辑：

- 翻译不扣 AI 额度。
- 客服建议不扣 AI 额度。
- 社媒图文基础发布不扣额度。
- AI 商品图扣图片额度。
- AI 视频扣视频额度，但视频本轮暂停测试。

---

### 6.9 社媒发布

路径：

```text
/social
```

当前只保留：

- VK。
- Wibus。

已完成：

- VK / Wibus 接入配置入口。
- 社媒文案生成。
- 发布按钮有 pending 状态和 toast 反馈。
- 视频发布本轮暂停。

待完成：

- VK 真实 OAuth / Access Token 发布 API。
- Wibus 真实发布 API。
- 图片素材和发布结果回写。

---

### 6.10 客服助手

路径：

```text
/customer
```

已完成：

- 客服消息列表。
- 消息分类。
- AI 回复建议。
- 一键发送回复的模拟动作。
- 按钮有 pending 状态和 toast 反馈。

当前逻辑：

- 接入百炼后可以生成真实回复建议。
- 真实发送到 Ozon 客服系统仍需要 Ozon 对应消息 API。

---

### 6.11 API 接入中心

路径：

```text
/integrations
```

当前接入项：

| 接入项 | Provider | 用途 |
|---|---|---|
| 阿里云百炼 / 通义千问 | `dashscope` | 文案、翻译、客服、AI 商品图、后续视频 |
| Ozon 市场搜索 / 热销榜数据源 | `ozon_market` | 全 Ozon 商品搜索、类目搜索、Top10-20 |
| 1688 / 阿里开放平台 | `source_1688` | 真实 1688 采集 |
| VK 社媒发布 | `vk` | VK 图文发布 |
| Wibus 社媒发布 | `wibus` | Wibus 图文发布 |

已完成：

- 所有接入项均是真实可填表单。
- 密钥加密入库。
- 页面只显示是否保存，不显示密钥明文。
- 百炼有文本模型测试按钮。
- 保存成功/失败有 toast 反馈。

---

### 6.12 AI 额度

路径：

```text
/credits
```

已完成：

- 图片额度。
- 视频额度。
- 使用记录。
- 任务日志记录每次扣费或免费动作。

规则：

- 商品图生成扣 `imageCredits`。
- 视频生成扣 `videoCredits`。
- 翻译、客服、社媒图文基础动作不扣。

---

### 6.13 任务记录

路径：

```text
/tasks
```

已完成：

- 所有关键动作写入 `TaskLog`。
- 包括研究、采集、翻译、生图、上传、社媒、客服等。

---

### 6.14 管理后台

路径：

```text
/admin
```

已完成：

- 用户审核。
- 用户状态管理。
- 套餐和过期时间设置。
- 管理员权限保护。

待优化：

- 额度充值管理可进一步产品化。
- 普通卖家后台和管理员后台的信息边界需继续明确。

---

## 7. 当前 API 路由

主要 API Routes：

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout

GET|POST /api/stores
POST /api/stores/[id]/ozon-probe
POST /api/stores/[id]/ozon-sync

GET /api/products/search
GET|PATCH /api/products/[id]
POST /api/products/[id]/translate
POST /api/products/[id]/translate-image-text
POST /api/products/[id]/generate-image
POST /api/products/[id]/generate-video
POST /api/products/[id]/upload

GET /api/tasks
GET /api/image-proxy
```

Server Actions：

```text
app/admin/actions.ts
app/customer/actions.ts
app/dashboard/actions.ts
app/integrations/actions.ts
app/products/actions.ts
app/research/actions.ts
app/social/actions.ts
```

---

## 8. 第三方接口状态

| 接口 | 当前状态 | 说明 |
|---|---|---|
| Ozon Seller API | 已接入基础读取 | 权限、仓库、商品、订单可测 |
| Ozon 全站市场搜索 | 接入入口已完成，待真实数据源 | 需要第三方 API、前台采集服务或自建爬虫 |
| 1688 | 接入入口已完成，待真实 API/采集 | 不显示 mock 商品图 |
| 阿里云百炼 / DashScope | 已接入 | 文本、社媒文案、客服建议、生图已测试过 |
| VK | 接入入口已完成，待真实发布 API | 当前保存配置与模拟发布 |
| Wibus | 接入入口已完成，待真实发布 API | 当前保存配置与模拟发布 |
| Ozon 真实上架写入 | 暂停 | 当前为 mock adapter，避免误改线上商品 |
| AI 视频 | 暂停测试 | 需要确认百炼视频端点和模型权限 |

---

## 9. 部署状态

当前部署：

| 项 | 内容 |
|---|---|
| 云服务器 | 阿里云香港 ECS |
| 公网 IP | `47.239.96.230` |
| 域名 | 暂无 |
| Web 入口 | `http://47.239.96.230` |
| 容器 | `ozon-ai-app-1` |
| 数据库容器 | `ozon-ai-postgres-1` |
| 反向代理 | Nginx |
| App 端口 | `127.0.0.1:3000` |
| PostgreSQL | Docker 内网，不对公网开放 |

线上验证结果：

- 服务器恢复后容器可启动。
- `http://47.239.96.230` 可访问。
- Docker app 容器可正常运行。
- PostgreSQL 容器可正常运行。
- 线上 `next build` 通过。
- 线上数据库迁移成功。
- `IntegrationProvider` 已包含：

```text
dashscope
source_1688
vk
wibus
ozon_market
```

最近一次部署执行过：

```bash
rsync -az --delete --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='.env*' --exclude='.local' --exclude='.playwright-cli' -e 'ssh -i ~/.ssh/ozon_ai_hk_ed25519' ./ root@47.239.96.230:/opt/ozon-ai/
ssh -i ~/.ssh/ozon_ai_hk_ed25519 root@47.239.96.230 'cd /opt/ozon-ai && docker compose up -d --build app'
ssh -i ~/.ssh/ozon_ai_hk_ed25519 root@47.239.96.230 'cd /opt/ozon-ai && docker compose run --rm app npx prisma migrate deploy'
```

---

## 10. 服务器暂停与恢复

如果不想继续消耗服务器运行资源，可以停止服务。

停止应用服务：

```bash
ssh -i ~/.ssh/ozon_ai_hk_ed25519 root@47.239.96.230
cd /opt/ozon-ai
docker compose stop
systemctl stop nginx
```

恢复应用服务：

```bash
ssh -i ~/.ssh/ozon_ai_hk_ed25519 root@47.239.96.230
cd /opt/ozon-ai
docker compose start
systemctl start nginx
```

注意：

- ECS 控制台“停止实例”可以减少计算费用。
- 如果选择节省停机模式，可能释放公网 IP。
- 当前没有域名，所以公网 IP 一旦变化，需要重新告知和重新配置访问地址。

---

## 11. 环境变量结构

本项目需要的关键环境变量：

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="http://47.239.96.230"
OZON_API_KEY_ENCRYPTION_SECRET="long-random-secret"

AI_PROVIDER="dashscope"
DASHSCOPE_API_KEY="sk-..."
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_TEXT_MODEL="qwen3.6-plus"
QWEN_FAST_MODEL="qwen3.6-flash"
QWEN_IMAGE_MODEL="qwen-image-2.0-pro"
QWEN_VIDEO_MODEL=""
OZON_API_BASE_URL="https://api-seller.ozon.ru"
```

安全规则：

- 不在文档记录真实 `DASHSCOPE_API_KEY`。
- 不在文档记录真实 Ozon API Key。
- 不在文档记录数据库密码。
- 所有页面表单中的密钥都加密保存，前端不回显明文。

---

## 12. 已完成的重要改动记录

### 2026-05 阶段

- 建立初始 Next.js + TypeScript + Tailwind + Prisma 项目结构。
- 创建静态 HTML demo `ozon-mvp-demo.html`。
- 完成登录、店铺、商品、任务日志的基础 MVP 页面。
- 建立 README 和 conversation context 文档。
- 初步定义 Ozon 卖家 AI 运营工作台方向。

### 2026-05-26 阶段

- 将产品从普通 demo 改为“私有 Ozon AI 跨境运营平台”。
- 引入用户状态：
  - pending。
  - approved。
  - expired。
  - suspended。
- 引入 AI 额度。
- 明确翻译不扣额度，商品图和视频扣额度。
- 加入社媒发布、客服助手、管理后台等模块。

### 2026-06 上旬

- 推进真实 SaaS 骨架。
- 修复 Vercel / Prisma 构建问题。
- 建立阿里云香港 ECS 部署方向。
- 新增 Dockerfile、docker-compose、Nginx 配置。
- 新增百炼 / DashScope Provider。
- UI 方向调整为“新疆边贸商贸运营台”，不是旅游化新疆视觉。

### 2026-06 中旬

- 接入 Ozon Seller API 基础读取。
- 店铺页可测试权限、仓库、商品、订单。
- Ozon 调研显示真实 Seller API 商品图。
- 商品池详情页图片管理支持删除、替换、排序。
- 社媒和客服按钮增加 pending 状态和 toast 反馈。
- API 接入中心增加真实可填表单。
- 百炼文本、社媒文案、客服回复、生图能力完成测试。
- 修复 DashScope 生图 native endpoint。

### 2026-06-17 当前更新

- 新增 `ozon_market` 接入类型。
- 新增 Ozon 市场搜索适配器：
  - 可配置 API Base URL。
  - 可配置搜索路径。
  - 可配置关键词参数名、类目参数名、数量参数名。
  - 可配置鉴权 Header、鉴权前缀。
  - 可配置结果数组路径。
- Ozon 调研拆成：
  - `Ozon 全站市场搜索`。
  - `我的店铺 Seller API`。
- 未接 Ozon 市场数据源时不再展示假商品。
- 市场搜索商品入池动作已完成。
- 商品详情页 AI 生图新增参考原图选择。
- 支持“原图参考 → 反推提示词 → 编辑提示词 → 生图 → 加入商品图”。
- 线上数据库迁移成功。
- 线上 Docker 重建成功。
- 线上页面验证通过。

---

## 13. 当前验证结果

本地验证：

```bash
npm run build
npm run test:unit
```

结果：

- `npm run build` 通过。
- `tests/product-images.test.mjs` 通过。
- 仅有一个既有 warning：`ReliableProductImage` 使用 `<img>`，Next.js 建议使用 `next/image`。该 warning 不影响功能运行。

线上验证：

```text
/integrations
/research/ozon?mode=market
/products/[id]
```

验证命中：

- API 接入页显示 `Ozon 市场搜索 / 热销榜数据源`。
- API 接入页显示 5 个接入项。
- Ozon 调研页显示 `Ozon 全站市场搜索`。
- 未接市场数据源时显示 `这里暂时不会放假数据`。
- 商品详情页显示 `AI 生成参考区`。
- 商品详情页显示 `参考原图反推提示词`。
- 商品详情页显示 `用提示词生图`。

---

## 14. 当前未完成事项

### 高优先级

1. 接入真实 Ozon 市场数据源。
   - 需要第三方 Ozon 市场搜索 API、榜单 API、前台采集服务，或自建爬虫服务。
   - 没有该数据源，无法真实实现全 Ozon 搜索、热销 Top10-20、类目榜单。

2. 接入真实 1688 数据源。
   - 可选路径：1688 商品链接采集。
   - 可选路径：阿里开放平台 API。
   - 必须保留真实商品图链接。

3. 完善商品池首页体验。
   - 当前已改善，但仍需继续从用户视角强化“第一眼看到重要信息”。
   - Ozon 调研入池后的商品需要更清晰显示来源、图、价格、状态、下一步操作。

4. 真实 Ozon 上架写入。
   - 当前为 mock adapter。
   - 正式接入前需要确认 Ozon 商品创建/更新 API、类目属性、物流、库存、价格和图片上传规则。
   - 测试阶段不应误改真实 Ozon 商品。

5. 普通卖家视角与管理员视角分离。
   - 普通卖家不应看到百炼、服务器部署、底层 API 供应商等信息。
   - 普通卖家应看到充值、额度、商品、任务、运营结果。

### 中优先级

1. AI 生成图接 OSS。
2. VK 真实发布 API。
3. Wibus 真实发布 API。
4. Ozon 客服消息真实 API。
5. AI 视频模型端点确认。
6. Dashboard 继续优化首屏信息密度。
7. 商品池详情页进一步减少下拉操作。

### 低优先级

1. 域名绑定和 HTTPS。
2. CDN / OSS / 日志监控。
3. RDS PostgreSQL 替换 ECS 内 PostgreSQL。
4. 更完整的 E2E 自动化测试。

---

## 15. 下一步建议路线

建议下一阶段按以下顺序推进：

1. 先确定 Ozon 全站市场数据来源。
   - 如果没有真实 API，当前无法真实完成全站搜索。
   - 这是 Ozon 调研模块从“可用页面”变成“真实选品工具”的关键。

2. 接入 1688 真实采集。
   - 让商品池有稳定供应链来源。
   - Ozon 调研负责市场参考，1688 负责货源参考。

3. 重构商品池首页。
   - 目标是“像淘宝商品搜索/运营货盘一样直观”。
   - 每个商品卡片第一眼显示主图、标题、价格、来源、状态、下一步。

4. 接真实图片存储。
   - AI 生成图保存到 OSS。
   - 商品图片和社媒图片有稳定 URL。

5. 接真实 Ozon 上架前，先做“上架前检查清单”。
   - 类目属性。
   - 标题俄文。
   - 描述俄文。
   - 主图。
   - 价格。
   - 库存。
   - 物流。
   - 合规风险。

6. 最后接真实 Ozon 上架写入。

---

## 16. 关键文件索引

### Ozon 调研

```text
app/research/ozon/page.tsx
app/research/actions.ts
components/OzonResearchConsole.tsx
components/OzonPoolButton.tsx
lib/services/ozon.ts
lib/services/ozon-market.ts
```

### 商品池与 AI 生图

```text
app/products/page.tsx
app/products/[id]/page.tsx
app/products/actions.ts
components/ProductActionControls.tsx
components/ProductImageManager.tsx
components/AiGeneratedImagePanel.tsx
lib/product-images.ts
lib/ai/provider.ts
lib/ai/prompts.ts
```

### API 接入

```text
app/integrations/page.tsx
app/integrations/actions.ts
components/IntegrationFeedbackForms.tsx
lib/integrations.ts
```

### 店铺

```text
app/stores/page.tsx
app/stores/new/page.tsx
app/api/stores/route.ts
app/api/stores/[id]/ozon-probe/route.ts
app/api/stores/[id]/ozon-sync/route.ts
components/OzonStoreConsole.tsx
components/NewStoreForm.tsx
```

### 社媒 / 客服

```text
app/social/page.tsx
app/social/actions.ts
components/SocialActionControls.tsx
app/customer/page.tsx
app/customer/actions.ts
components/CustomerActionControls.tsx
```

### 部署

```text
Dockerfile
docker-compose.yml
deploy/nginx/ozon-ai-ops.conf
docs/aliyun-hk-deployment.md
```

---

## 17. 当前 Git 状态说明

当前工作树存在大量未提交变更，包含：

- 多个页面重构。
- API 接入中心。
- Ozon 市场数据源。
- 商品图片管理。
- AI 生图参考区。
- Docker / ECS 部署文件。
- Prisma migrations。
- 测试文件。

当前最近 Git commit：

```text
b34af7b run prisma generate during vercel build
2199f00 mark all api routes dynamic
f70eb48 mark auth api routes dynamic
73a124c fix vercel linux dependency install
b4629b5 init ozon ai ops platform
```

建议在确认当前功能后执行一次正式提交，避免后续改动过多难以追踪。

---

## 18. 总结

OzonAI 当前已经从最初静态 demo，推进到一个可部署、可登录、可绑定店铺、可接百炼、可管理商品池、可测试 Ozon Seller API、可进行 AI 文案和 AI 商品图工作流的测试型 SaaS。

当前最大的真实业务缺口不是页面，而是外部数据源：

- Ozon 全站市场搜索需要真实市场数据接口。
- 1688 采集需要真实商品采集接口。
- VK / Wibus 需要真实发布接口。
- Ozon 上架需要谨慎接真实写入 API。

当前系统已经把这些入口都做成真实可填、可扩展的结构。下一步应优先补真实数据源，而不是继续堆 mock 页面。
