import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const typeLabels: Record<string, string> = {
  collect: "采集",
  research: "Ozon调研",
  translate: "翻译",
  image: "AI生图",
  video: "AI视频",
  upload: "上传Ozon",
  social_post: "社媒内容",
  social_video: "社媒视频",
  social_publish: "社媒发布",
  customer_message: "客服消息",
  auto_reply: "自动回复",
  alert: "提醒"
};

export default async function TasksPage() {
  const user = await requireApprovedUser();
  const tasks = await prisma.taskLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <AppShell title="任务记录" eyebrow="Operations Log" user={user}>
      <section className="mb-5 ledger-card p-5">
        <p className="text-xs font-bold text-accent">操作留痕</p>
        <h3 className="mt-2 font-display text-4xl">所有测试动作都要留下轨迹</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          Ozon 同步、商品入池、AI 任务、社媒发布和客服动作都会写入这里。上线前用它确认每个栏目是否走通。
        </p>
      </section>

      <div className="ledger-card overflow-hidden">
        <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold text-steel">
          <span className="col-span-2">类型</span>
          <span className="col-span-2">状态</span>
          <span className="col-span-2">消耗额度</span>
          <span className="col-span-4">备注</span>
          <span className="col-span-2 text-right">时间</span>
        </div>

        {tasks.length === 0 && <p className="p-5 text-sm text-steel">暂无任务记录。</p>}

        {tasks.map((task) => (
          <div key={task.id} className="grid grid-cols-12 gap-3 border-b border-line px-4 py-4 transition hover:bg-paper/45 last:border-b-0">
            <div className="col-span-12 font-bold md:col-span-2">{typeLabels[task.type] ?? task.type}</div>
            <div className="status-chip col-span-6 w-fit md:col-span-2">{task.status}</div>
            <div className="col-span-6 text-sm text-steel md:col-span-2">{task.creditCost}</div>
            <div className="col-span-12 text-sm leading-6 text-steel md:col-span-4">{task.message}</div>
            <div className="col-span-12 text-xs text-steel md:col-span-2 md:text-right">{task.createdAt.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
