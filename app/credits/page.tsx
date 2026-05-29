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

  return (
    <AppShell title="AI额度" eyebrow="Credit Center" user={user}>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="当前会员等级" value={user.plan} detail="starter / pro / vip" />
        <MetricCard label="AI商品图剩余额度" value={String(user.credits?.imageCredits ?? 0)} detail="生成商品图时扣减" />
        <MetricCard label="AI视频剩余额度" value={String(user.credits?.videoCredits ?? 0)} detail="生成视频时扣减" />
      </div>
      <section className="ledger-card mt-6 p-5">
        <h3 className="font-display text-3xl">额度规则</h3>
        <p className="mt-3 leading-7 text-steel">翻译、上传、客服回复、社媒图文发布为基础功能，不消耗 AI额度。AI商品图和AI视频会消耗额度。</p>
        <button className="btn-primary mt-5">联系管理员充值额度</button>
      </section>

      <section className="ledger-card mt-6 overflow-hidden">
        <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-steel">
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
            <span className="col-span-4 text-steel md:col-span-2">{task.status}</span>
            <span className="col-span-4 text-steel md:col-span-2">{task.creditCost}</span>
            <span className="col-span-12 text-steel md:col-span-4">{task.message}</span>
            <span className="col-span-12 text-steel md:col-span-2 md:text-right">{task.createdAt.toLocaleString()}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
