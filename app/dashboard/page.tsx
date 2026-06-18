import Link from "next/link";
import { Boxes, Clock3, Image, Megaphone, PackageSearch, Rocket, Search, Store } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planLabel: Record<string, string> = {
  starter: "基础会员",
  pro: "专业会员",
  vip: "高级会员"
};

function formatTime(date: Date) {
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const user = await requireApprovedUser();
  const [
    storeCount,
    productCounts,
    socialPostCounts,
    recentResearchTasks,
    recentProductAdds,
    recentPublishTasks
  ] = await Promise.all([
    prisma.store.count({ where: { userId: user.id } }),
    prisma.product.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    prisma.socialPost.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    prisma.taskLog.findMany({ where: { userId: user.id, type: { in: ["research", "collect"] } }, orderBy: { createdAt: "desc" }, take: 4, include: { product: true } }),
    prisma.taskLog.findMany({ where: { userId: user.id, type: { in: ["translate", "image"] } }, orderBy: { createdAt: "desc" }, take: 4, include: { product: true } }),
    prisma.taskLog.findMany({ where: { userId: user.id, type: { in: ["upload", "social_publish"] } }, orderBy: { createdAt: "desc" }, take: 4, include: { product: true } })
  ]);

  const count = (status: string) => productCounts.find((c) => c.status === status)?._count._all ?? 0;
  // V3 商品 7 阶段生命周期
  const todoDiscovered = count("discovered");
  const todoOptimizing = count("optimizing");
  const todoReady = count("optimized") + count("ready_to_publish");
  const todoPublished = count("published");
  const totalProducts = todoDiscovered + todoOptimizing + todoReady + todoPublished;

  const sCount = (status: string) => socialPostCounts.find((c) => c.status === status)?._count._all ?? 0;
  const contentDraft = sCount("draft") + sCount("pending_review") + sCount("ready");
  const contentPublished = sCount("published");

  const imageCredits = user.credits?.imageCredits ?? 0;
  const videoCredits = user.credits?.videoCredits ?? 0;

  const todoCards = [
    { label: "待处理商品", value: todoDiscovered, href: "/products", icon: PackageSearch, hint: "刚入池，待整理" },
    { label: "待优化商品", value: todoOptimizing, href: "/products", icon: Image, hint: "AI 优化中" },
    { label: "待上架商品", value: todoReady, href: "/products", icon: Boxes, hint: "优化完成，可铺品" },
    { label: "已上架商品", value: todoPublished, href: "/stores", icon: Rocket, hint: "已发布到 Ozon" }
  ];

  return (
    <AppShell title="卖家工作台" eyebrow="Seller Home" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">今日待办</p>
            <h3>从市场研究到 Ozon 上架，追踪每个商品的流转进度。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>{planLabel[user.plan]}</span>
            <span>{user.status}</span>
            <span>额度 图{imageCredits}/视频{videoCredits}</span>
          </div>
        </div>

        {/* 待办工作流卡片 */}
        <div className="dashboard-kpi-grid">
          {todoCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="dashboard-kpi-card">
                <div className="dashboard-kpi-head">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <div className="dashboard-kpi-value">
                  <strong>{item.value}</strong>
                  <span>件</span>
                </div>
                <p>{item.hint}</p>
              </Link>
            );
          })}
        </div>

        {/* 内容推广概览 */}
        <div className="dashboard-main-grid mt-5">
          <section className="dashboard-panel compact">
            <div className="dashboard-panel-title">
              <span>内容推广</span>
              <Link href="/content">内容中心</Link>
            </div>
            <div className="dashboard-ai-grid">
              <div>
                <strong>{contentDraft}</strong>
                <span>待推广内容</span>
              </div>
              <div>
                <strong>{contentPublished}</strong>
                <span>已推广内容</span>
              </div>
              <Link href="/content" className="ready">
                <strong>去发布</strong>
                <span>VK / Wibes</span>
              </Link>
            </div>
          </section>

          <section className="dashboard-panel compact">
            <div className="dashboard-panel-title">
              <span>快捷入口</span>
            </div>
            <div className="dashboard-queue">
              <Link href="/research/ozon" className="dashboard-queue-row">
                <Search size={14} />
                <span>市场研究</span>
                <strong>{storeCount ? "可调研" : "先绑店"}</strong>
              </Link>
              <Link href="/products" className="dashboard-queue-row">
                <Boxes size={14} />
                <span>商品中心</span>
                <strong>{totalProducts} 件</strong>
              </Link>
              <Link href="/ai-studio" className="dashboard-queue-row">
                <Image size={14} />
                <span>AI 工作台</span>
                <strong>生成</strong>
              </Link>
              <Link href="/stores" className="dashboard-queue-row">
                <Store size={14} />
                <span>店铺中心</span>
                <strong>{storeCount} 店</strong>
              </Link>
              <Link href="/membership" className="dashboard-queue-row">
                <Megaphone size={14} />
                <span>会员中心</span>
                <strong>{planLabel[user.plan]}</strong>
              </Link>
            </div>
          </section>
        </div>

        {/* 最近任务三栏 */}
        <div className="dashboard-main-grid mt-5">
          <section className="dashboard-panel tasks">
            <div className="dashboard-panel-title">
              <span>最近发现商品</span>
              <Link href="/research/ozon">去研究</Link>
            </div>
            <div className="dashboard-task-list">
              {recentResearchTasks.length === 0 && <p className="dashboard-empty">暂无研究记录。</p>}
              {recentResearchTasks.map((task) => (
                <div key={task.id} className="dashboard-task-row">
                  <Clock3 size={14} />
                  <strong>{task.type}</strong>
                  <span>{task.status}</span>
                  <p>{task.message.slice(0, 40)}</p>
                  <time>{formatTime(task.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-panel tasks">
            <div className="dashboard-panel-title">
              <span>最近加入商品中心</span>
              <Link href="/products">全部商品</Link>
            </div>
            <div className="dashboard-task-list">
              {recentProductAdds.length === 0 && <p className="dashboard-empty">暂无商品处理记录。</p>}
              {recentProductAdds.map((task) => (
                <div key={task.id} className="dashboard-task-row">
                  <Clock3 size={14} />
                  <strong>{task.type}</strong>
                  <span>{task.status}</span>
                  <p>{task.product?.title?.slice(0, 30) || task.message.slice(0, 30)}</p>
                  <time>{formatTime(task.createdAt)}</time>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-panel tasks">
            <div className="dashboard-panel-title">
              <span>最近发布</span>
              <Link href="/content">内容中心</Link>
            </div>
            <div className="dashboard-task-list">
              {recentPublishTasks.length === 0 && <p className="dashboard-empty">暂无发布记录。</p>}
              {recentPublishTasks.map((task) => (
                <div key={task.id} className="dashboard-task-row">
                  <Clock3 size={14} />
                  <strong>{task.type}</strong>
                  <span>{task.status}</span>
                  <p>{task.product?.title?.slice(0, 30) || task.message.slice(0, 30)}</p>
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
