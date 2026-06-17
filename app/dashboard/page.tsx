import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, Clock3, Coins, Database, Image, KeyRound, PackageSearch, Server, Store, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { imageList } from "@/lib/product-images";
import { prisma } from "@/lib/prisma";
import { prepareFullSiteTest } from "./actions";

const planLabel: Record<string, string> = {
  starter: "基础会员",
  pro: "专业会员",
  vip: "高级会员"
};

function percent(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.min(Math.round((value / max) * 100), 100)}%`;
}

function formatTime(date: Date) {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function DashboardPage() {
  const user = await requireApprovedUser();
  const [
    storeCount,
    productsForImages,
    taskCount,
    failedTaskCount,
    pendingCustomerCount,
    connectedSocialCount,
    dashscopeIntegration,
    apiIntegrationCount,
    recentTasks
  ] = await Promise.all([
    prisma.store.count({ where: { userId: user.id } }),
    prisma.product.findMany({ where: { userId: user.id }, select: { images: true }, take: 120 }),
    prisma.taskLog.count({ where: { userId: user.id } }),
    prisma.taskLog.count({ where: { userId: user.id, status: "failed" } }),
    prisma.customerMessage.count({ where: { userId: user.id, status: { in: ["pending", "alert"] } } }),
    prisma.socialAccount.count({ where: { userId: user.id, status: "connected", platform: { in: ["vk", "wibus"] } } }),
    prisma.apiIntegration.findUnique({ where: { userId_provider: { userId: user.id, provider: "dashscope" } } }),
    prisma.apiIntegration.count({ where: { userId: user.id, secretEncrypted: { not: null } } }),
    prisma.taskLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4
    })
  ]);

  const productCount = productsForImages.length;
  const productWithImages = productsForImages.filter((product) => imageList(product.images).length > 0).length;
  const imageCoverage = productCount ? Math.round((productWithImages / productCount) * 100) : 0;
  const imageCredits = user.credits?.imageCredits ?? 0;
  const videoCredits = user.credits?.videoCredits ?? 0;
  const isAdmin = user.role === "admin";
  const hasDashScope = Boolean(dashscopeIntegration?.secretEncrypted || process.env.DASHSCOPE_API_KEY);
  const adminStatusTiles = [
    { label: "数据库", value: "在线", state: "ready", icon: Database },
    { label: "Ozon API", value: storeCount ? "已绑定" : "待绑定", state: storeCount ? "ready" : "waiting", icon: Store },
    { label: "百炼模型", value: hasDashScope ? "已配置" : "待配置", state: hasDashScope ? "ready" : "waiting", icon: KeyRound },
    { label: "香港 ECS", value: "已部署", state: "ready", icon: Server }
  ];
  const sellerStatusTiles = [
    { label: "店铺", value: storeCount ? "已绑定" : "待绑定", state: storeCount ? "ready" : "waiting", icon: Store },
    { label: "商品池", value: productCount ? "有商品" : "待入池", state: productCount ? "ready" : "waiting", icon: PackageSearch },
    { label: "图片素材", value: productWithImages ? "可预览" : "待补图", state: productWithImages ? "ready" : "waiting", icon: Image },
    { label: "账户额度", value: imageCredits + videoCredits > 0 ? "可用" : "待充值", state: imageCredits + videoCredits > 0 ? "ready" : "waiting", icon: Coins }
  ];
  const statusTiles = isAdmin ? adminStatusTiles : sellerStatusTiles;
  const kpis = [
    { label: "店铺", value: storeCount, unit: "个", detail: "Ozon 接入", href: "/stores", icon: Store, fill: percent(storeCount, 2) },
    { label: "商品池", value: productCount, unit: "件", detail: `${productWithImages} 件有图`, href: "/products", icon: PackageSearch, fill: percent(productCount, 20) },
    { label: "图片覆盖", value: imageCoverage, unit: "%", detail: "真实图可用率", href: "/products", icon: Image, fill: `${imageCoverage}%` },
    { label: "客服", value: pendingCustomerCount, unit: "条", detail: "待处理", href: "/customer", icon: Users, fill: percent(pendingCustomerCount, 8) },
    { label: "社媒", value: connectedSocialCount, unit: "/2", detail: "VK / Wibus", href: "/social", icon: Bot, fill: percent(connectedSocialCount, 2) },
    ...(isAdmin ? [{ label: "API 接入", value: apiIntegrationCount, unit: "/4", detail: "百炼/1688/社媒", href: "/integrations", icon: KeyRound, fill: percent(apiIntegrationCount, 4) }] : []),
    { label: "失败任务", value: failedTaskCount, unit: "条", detail: `${taskCount} 条总任务`, href: "/tasks", icon: AlertTriangle, fill: percent(failedTaskCount, Math.max(taskCount, 1)) }
  ];
  const workQueue = [
    { label: "Ozon 调研", href: "/research/ozon", status: storeCount ? "可测" : "缺店铺" },
    { label: "商品池图片", href: "/products", status: productWithImages ? "可处理" : "缺图片" },
    { label: "客服建议", href: "/customer", status: isAdmin ? (hasDashScope ? "可真测" : "走 mock") : "可使用" },
    { label: "社媒预览", href: "/social", status: connectedSocialCount ? "可模拟" : "待授权" }
  ];

  return (
    <AppShell title="边贸运营控制台" eyebrow="Dashboard" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">今日看板</p>
            <h3>从 Ozon 选品到商品池、客服和社媒，一屏查看关键状态。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>{planLabel[user.plan]}</span>
            <span>{user.status}</span>
            <span>{user.expiresAt ? user.expiresAt.toLocaleDateString("zh-CN") : "未设到期"}</span>
          </div>
        </div>

        <div className="dashboard-status-grid">
          {statusTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className={`dashboard-status ${tile.state}`}>
                <Icon size={16} />
                <span>{tile.label}</span>
                <strong>{tile.value}</strong>
              </div>
            );
          })}
        </div>

        <div className="dashboard-kpi-grid">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="dashboard-kpi-card">
                <div className="dashboard-kpi-head">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <div className="dashboard-kpi-value">
                  <strong>{item.value}</strong>
                  <span>{item.unit}</span>
                </div>
                <p>{item.detail}</p>
                <div className="dashboard-mini-bar">
                  <i style={{ width: item.fill }} />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="dashboard-main-grid">
          <section className="dashboard-panel compact">
            <div className="dashboard-panel-title">
              <span>接下来优先处理</span>
              <form action={prepareFullSiteTest}>
                <button className="dashboard-inline-action">准备测试数据</button>
              </form>
            </div>
            <div className="dashboard-queue">
              {workQueue.map((item) => (
                <Link key={item.href} href={item.href} className="dashboard-queue-row">
                  <span>{item.label}</span>
                  <strong>{item.status}</strong>
                </Link>
              ))}
            </div>
          </section>

          <section className="dashboard-panel compact">
            <div className="dashboard-panel-title">
              <span>{isAdmin ? "AI 资源" : "账户额度"}</span>
              <Link href={isAdmin ? "/integrations" : "/credits"}>{isAdmin ? "API 接入" : "充值额度"}</Link>
            </div>
            <div className="dashboard-ai-grid">
              <div>
                <strong>{imageCredits}</strong>
                <span>商品图额度</span>
              </div>
              <div>
                <strong>{videoCredits}</strong>
                <span>视频额度</span>
              </div>
              <div className={isAdmin ? (hasDashScope ? "ready" : "waiting") : (imageCredits + videoCredits > 0 ? "ready" : "waiting")}>
                <strong>{isAdmin ? (hasDashScope ? "已接入" : "待接入") : (imageCredits + videoCredits > 0 ? "可用" : "待充值")}</strong>
                <span>{isAdmin ? "百炼 Key" : "服务状态"}</span>
              </div>
            </div>
          </section>

          <section className="dashboard-panel tasks">
            <div className="dashboard-panel-title">
              <span>最近任务</span>
              <Link href="/tasks">全部</Link>
            </div>
            <div className="dashboard-task-list">
              {recentTasks.length === 0 && <p className="dashboard-empty">暂无任务记录。</p>}
              {recentTasks.map((task) => (
                <div key={task.id} className="dashboard-task-row">
                  <Clock3 size={14} />
                  <strong>{task.type}</strong>
                  <span>{task.status}</span>
                  <p>{task.message}</p>
                  <time>{formatTime(task.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>

          {isAdmin ? (
            <section className="dashboard-panel compact">
              <div className="dashboard-panel-title">
                <span>上线缺口</span>
                <CheckCircle2 size={15} />
              </div>
              <div className="dashboard-gap-list">
                <span>香港 ECS 已部署，后续补域名 HTTPS</span>
                <span>{hasDashScope ? "百炼已接入，下一步测文本" : "百炼 DashScope Key"}</span>
                <span>1688 真实采集接口配置</span>
                <span>VK / Wibus 真实发布配置</span>
              </div>
            </section>
          ) : (
            <section className="dashboard-panel compact">
              <div className="dashboard-panel-title">
                <span>账户服务</span>
                <CheckCircle2 size={15} />
              </div>
              <div className="dashboard-gap-list">
                <span>店铺绑定后即可同步商品</span>
                <span>额度不足时联系管理员充值</span>
                <span>商品池图片可直接预览和编辑</span>
                <span>客服、社媒、商品图按额度使用</span>
              </div>
            </section>
          )}
        </div>
      </section>
    </AppShell>
  );
}
