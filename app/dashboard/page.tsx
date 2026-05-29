import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planLabel: Record<string, string> = {
  starter: "基础会员",
  pro: "专业会员",
  vip: "高级会员"
};

export default async function DashboardPage() {
  const user = await requireApprovedUser();
  const [storeCount, productCount, taskCount, recentTasks] = await Promise.all([
    prisma.store.count({ where: { userId: user.id } }),
    prisma.product.count({ where: { userId: user.id } }),
    prisma.taskLog.count({ where: { userId: user.id } }),
    prisma.taskLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6
    })
  ]);

  return (
    <AppShell title="运营控制台" eyebrow="Dashboard" user={user}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="账号状态" value="已开通" detail={`角色：${user.role}`} />
        <MetricCard label="会员等级" value={planLabel[user.plan]} detail={user.expiresAt ? `到期：${user.expiresAt.toLocaleDateString()}` : "未设置到期时间"} />
        <MetricCard label="Ozon 店铺" value={String(storeCount)} detail="统一绑定 Ozon 跨境电商店铺" />
        <MetricCard label="任务记录" value={String(taskCount)} detail="采集、翻译、生图、视频、上传等操作日志" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="AI商品图额度" value={String(user.credits?.imageCredits ?? 0)} detail="AI 商品图生成会消耗额度" />
        <MetricCard label="AI视频额度" value={String(user.credits?.videoCredits ?? 0)} detail="AI 视频生成会消耗额度" />
        <MetricCard label="基础翻译功能" value="已开通" detail="翻译、图片文字翻译不消耗额度" />
        <MetricCard label="商品池" value={String(productCount)} detail="后续模块逐步接入真实业务" />
      </div>

      <section className="ledger-card mt-6 p-5">
        <div className="border-b border-line pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Recent Tasks</p>
          <h3 className="mt-2 font-display text-3xl">最近任务记录</h3>
        </div>
        <div className="mt-4 divide-y divide-line">
          {recentTasks.length === 0 && <p className="py-4 text-sm text-steel">暂无任务。真实功能接入后会写入 TaskLog。</p>}
          {recentTasks.map((task) => (
            <div key={task.id} className="grid gap-2 py-4 md:grid-cols-[160px_120px_1fr_160px]">
              <strong>{task.type}</strong>
              <span className="text-sm text-steel">{task.status}</span>
              <span className="text-sm text-steel">{task.message}</span>
              <span className="text-right text-xs text-steel">{task.createdAt.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
