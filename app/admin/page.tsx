import Link from "next/link";
import { AlertTriangle, Boxes, Bot, Database, KeyRound, Rocket, Search, Settings, Store, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatTime(date: Date) {
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminConsolePage() {
  const user = await requireAdminUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalStores,
    totalProducts,
    todayResearch,
    todayAiTasks,
    todayPublish,
    failedTasks,
    integrations,
    recentFailed
  ] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.product.count(),
    prisma.taskLog.count({ where: { type: { in: ["research", "collect"] }, createdAt: { gte: today } } }),
    prisma.taskLog.count({ where: { type: { in: ["translate", "image", "video"] }, createdAt: { gte: today } } }),
    prisma.taskLog.count({ where: { type: { in: ["upload", "social_publish"] }, createdAt: { gte: today } } }),
    prisma.taskLog.count({ where: { status: "failed" } }),
    prisma.apiIntegration.count({ where: { secretEncrypted: { not: null } } }),
    prisma.taskLog.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: 5, include: { user: true } })
  ]);

  const stats = [
    { label: "总客户数", value: totalUsers, unit: "人", href: "/admin/customers", icon: Users },
    { label: "总店铺数", value: totalStores, unit: "店", href: "/admin/customers", icon: Store },
    { label: "总商品数", value: totalProducts, unit: "件", href: "/admin/customers", icon: Boxes },
    { label: "今日研究", value: todayResearch, unit: "次", href: "/tasks", icon: Search },
    { label: "今日AI任务", value: todayAiTasks, unit: "次", href: "/admin/ai", icon: Bot },
    { label: "今日发布", value: todayPublish, unit: "次", href: "/tasks", icon: Rocket },
    { label: "失败任务", value: failedTasks, unit: "条", href: "/tasks", icon: AlertTriangle },
    { label: "集成接入", value: integrations, unit: "项", href: "/integrations", icon: KeyRound }
  ];

  const menuCards = [
    { label: "客户管理", desc: "审核 / 冻结 / 套餐 / 额度", href: "/admin/customers", icon: Users },
    { label: "数据源中心", desc: "Ozon / 1688 / Wildberries", href: "/admin/datasources", icon: Database },
    { label: "AI 中心", desc: "Qwen / 图片 / 视频模型", href: "/admin/ai", icon: Bot },
    { label: "集成中心", desc: "Research / AI / Marketplace / Social", href: "/integrations", icon: KeyRound },
    { label: "任务中心", desc: "Research / AI / Publish / Sync", href: "/tasks", icon: Search },
    { label: "系统设置", desc: "平台配置", href: "/admin/settings", icon: Settings }
  ];

  return (
    <AppShell title="平台控制台" eyebrow="Admin Console" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">平台概览</p>
            <h3>总览客户、店铺、商品、任务与发布全链路状态。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>管理员</span>
            <span>{user.email}</span>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          {stats.map((item) => {
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
              </Link>
            );
          })}
        </div>

        <div className="dashboard-main-grid mt-5">
          <section className="dashboard-panel compact">
            <div className="dashboard-panel-title">
              <span>管理入口</span>
            </div>
            <div className="dashboard-queue">
              {menuCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="dashboard-queue-row">
                    <Icon size={14} />
                    <span>{item.label}</span>
                    <strong>{item.desc}</strong>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="dashboard-panel tasks">
            <div className="dashboard-panel-title">
              <span>最近失败任务</span>
              <Link href="/tasks">全部任务</Link>
            </div>
            <div className="dashboard-task-list">
              {recentFailed.length === 0 && <p className="dashboard-empty">暂无失败任务。</p>}
              {recentFailed.map((task) => (
                <div key={task.id} className="dashboard-task-row">
                  <AlertTriangle size={14} />
                  <strong>{task.type}</strong>
                  <span>{task.status}</span>
                  <p>{task.user?.email} · {task.message.slice(0, 30)}</p>
                  <time>{formatTime(task.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
