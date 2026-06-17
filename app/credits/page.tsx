import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CreditsPage() {
  const user = await requireApprovedUser();
  const creditTasks = await prisma.taskLog.findMany({
    where: { userId: user.id, creditCost: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  const totalCredits = (user.credits?.imageCredits ?? 0) + (user.credits?.videoCredits ?? 0);

  return (
    <AppShell title="AI 额度中心" eyebrow="Credit Center" user={user}>
      <section className="mb-5 ledger-card p-5">
        <p className="text-xs font-bold text-accent">账户额度</p>
        <h3 className="mt-2 font-display text-4xl">按额度使用 AI 服务，额度不足时联系管理员充值</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          翻译、客服回复建议、社媒草稿、AI 商品图和视频生成会按规则消耗额度。卖家只需要关注剩余额度和使用记录，不需要配置底层模型或服务器。
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="当前会员等级" value={user.plan} detail="starter / pro / vip" />
        <MetricCard label="AI商品图剩余额度" value={String(user.credits?.imageCredits ?? 0)} detail="生成商品图时扣减" />
        <MetricCard label="账户服务状态" value={totalCredits > 0 ? "可用" : "待充值"} detail="额度不足请联系管理员" />
      </div>
      <section className="ledger-card mt-6 p-5">
        <h3 className="relative font-display text-3xl">额度规则</h3>
        <p className="relative mt-3 leading-7 text-steel">不同功能会消耗不同额度；商品同步、图片预览、任务记录等基础功能不扣 AI 额度。</p>
        <div className="relative mt-4 grid gap-3 md:grid-cols-2">
          <div className="border border-line bg-paper/70 p-4 text-sm leading-6 text-steel">
            <strong className="text-mint">现在可直接测</strong>
            <p className="mt-1">商品同步、图片预览、客服测试消息、VK/Wibus mock 发布、任务日志。</p>
          </div>
          <div className="border border-line bg-paper/70 p-4 text-sm leading-6 text-steel">
            <strong className="text-alert">需要消耗额度</strong>
            <p className="mt-1">AI 商品图、AI 视频、客服建议、翻译和社媒文案会按任务规则扣减额度。</p>
          </div>
        </div>
        <button className="btn-primary mt-5">联系管理员充值额度</button>
      </section>

      <section className="ledger-card mt-6 overflow-hidden">
        <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold text-steel">
          <span className="col-span-2">类型</span>
          <span className="col-span-2">状态</span>
          <span className="col-span-2">消耗</span>
          <span className="col-span-4">备注</span>
          <span className="col-span-2 text-right">时间</span>
        </div>
        {creditTasks.length === 0 && <p className="p-5 text-sm text-steel">暂无额度消耗记录。</p>}
        {creditTasks.map((task) => (
          <div key={task.id} className="grid grid-cols-12 gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0">
            <strong className="col-span-12 md:col-span-2">{task.type}</strong>
            <span className="status-chip col-span-4 w-fit md:col-span-2">{task.status}</span>
            <span className="col-span-4 text-steel md:col-span-2">{task.creditCost}</span>
            <span className="col-span-12 text-steel md:col-span-4">{task.message}</span>
            <span className="col-span-12 text-steel md:col-span-2 md:text-right">{task.createdAt.toLocaleString()}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
