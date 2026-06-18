# RESEARCH_CENTER_V4_AUDIT — 选品研究工具重构

> 版本：V4 | 日期：2026-06-19 | 状态：✅ 完成

---

## 一、新增页面

| 路由 | 文件 | 说明 |
|------|------|------|
| `/research` | `app/research/page.tsx` | Shell 入口 → redirect /research/1688 |
| `/research/1688` | `app/research/1688/page.tsx` | 1688 选品研究 |
| `/research/ozon` | `app/research/ozon/page.tsx` | Ozon 市场研究（重构） |

## 二、新增组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `ResearchShell` | `components/ResearchShell.tsx` | Tab 导航（1688/Ozon/Wildberries）+ AppShell 包装 |
| `Research1688Console` | `components/Research1688Console.tsx` | 1688 搜索/排序/价格筛选/卡片表格切换/批量导入 |

## 三、修改文件

| 文件 | 改动 |
|------|------|
| `lib/navigation.ts` | Seller 菜单：/research/ozon + /dashboard/sources/1688 → /research（Research Center） |
| `app/research/ozon/page.tsx` | 重构：AppShell → ResearchShell 包装 |
| `tsconfig.json` | exclude 新增 `scripts`（避免 backfill 脚本冲突构建） |

## 四、权限变更

| 角色 | 旧菜单 | 新菜单 | 变化 |
|------|--------|--------|------|
| Seller | 市场研究、1688采集（2项） | Research Center（1项统一入口） | 合并 |
| Admin | 数据源中心（含1688+Ozon） | 数据源中心（不变） | 无变化 |

**Admin 7 项菜单完全未动。Seller 和 Admin 权限彻底分离。**

## 五、Research1688Console 功能清单

| 模块 | 实现 |
|------|------|
| 关键词搜索 | ✅ 搜索框 + Enter/按钮触发 |
| 排序（销量/价格/评分/最新）| ✅ 下拉选择 |
| 价格区间（最低-最高）| ✅ 双输入框 |
| 卡片视图 | ✅ 图片+标题+价格+销量+供应商+评分 |
| 表格视图 | ✅ 表头+完整字段+checkbox |
| 视图切换按钮 | ✅ Card View / Table View |
| 批量选择（checkbox）| ✅ 单品勾选 + 全选 + 取消全选 |
| 导入商品池 | ✅ Add To Product Pool 按钮 → POST /api/sources/1688/import → discovered |

## 六、测试结果

| 项目 | 结果 |
|------|------|
| `npm run build` | ✅ 通过 |
| `npm run test:unit` | ✅ 23/23 pass |
| ESLint warnings | ⚠️ 1 (ReliableProductImage img tag, 已有) |

## 七、已知限制（V4.0）

| 限制 | 说明 |
|------|------|
| 1688 热销榜 | 依赖 Apify Actor devcake/1688-com-products-scraper 提供 trending 数据 |
| 时间范围筛选 | UI 预留 timeRange state，API 尚未实现 |
| Ozon 类目排行榜 | 复用现有 ozonMarketCategories，尚未对接 Apify category API |
| Wildberries Tab | UI 占位（Coming Soon），无页面 |
| 导入后状态 | 调用现有 `/api/sources/1688/import`，自动进入 Product status=discovered ✅ |
| 1688 搜索 | 调用 `/api/sources/1688/search`（已有路由），返回格式需匹配 Research1688Console 类型 |

## 八、架构对齐检查

| 要求 | 状态 |
|------|------|
| Research Center 是 Seller 功能，不是 Admin | ✅ Seller sidebar 专属 |
| Admin 数据源管理不变 | ✅ 7 项无变化 |
| Admin/Seller 权限分离 | ✅ |
| 更像研究工具，非统计面板 | ✅ 搜索+筛选+表格/卡片切换 |
| 导入写入 discovered 状态 | ✅ 调用现有 Product.create → status=discovered |
| 不创建新状态 | ✅ 复用 ProductStatus 枚举 |

## 九、下一步

1. 部署到线上 → 验证 `/research` 页面可访问
2. 对接 1688 Apify API 返回真实数据
3. Ozon 类目排行榜 UI（小改 OzonResearchConsole 加类目卡片）
4. Wildberries 对接（长期）
