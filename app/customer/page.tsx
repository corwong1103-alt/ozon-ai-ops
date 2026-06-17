import { AppShell } from "@/components/AppShell";
import { CustomerMessageButtons, SyncCustomerMessagesButton } from "@/components/CustomerActionControls";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const categoryLabel: Record<string, string> = {
  presale: "售前咨询",
  logistics: "物流问题",
  refund: "售后退款",
  review_alert: "差评提醒",
  inventory_alert: "库存提醒"
};

export default async function CustomerPage() {
  const user = await requireApprovedUser();
  const messages = await prisma.customerMessage.findMany({
    where: { userId: user.id },
    include: { store: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <AppShell title="多语言客服助手" eyebrow="Ozon Customer Desk" user={user}>
      <section className="mb-5 ledger-card p-5">
        <p className="text-xs font-bold text-accent">客服边界</p>
        <h3 className="mt-2 font-display text-4xl">客服流程可测，真实建议等大模型</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          现在可生成测试消息、分类、写任务日志和模拟发送；配置百炼 API Key 后，回复建议会切到真实大模型生成。
        </p>
      </section>

      <section className="ledger-card overflow-hidden">
        <div className="relative flex flex-col gap-3 border-b border-line bg-rail/45 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-3xl">Ozon 消息列表</h3>
            <p className="mt-1 text-sm text-steel">用于测试客服流程：消息分类、AI回复建议、一键回复、任务记录。当前不读取真实 Ozon 买家消息。</p>
          </div>
          <SyncCustomerMessagesButton />
        </div>
        {messages.length === 0 && <p className="p-5 text-sm text-steel">暂无客服消息。后续接入 Ozon 消息同步后显示。</p>}
        {messages.map((message) => (
          <div key={message.id} className="relative grid gap-3 border-b border-line px-4 py-4 transition hover:bg-paper/45 last:border-b-0 md:grid-cols-[1fr_160px_160px]">
            <div>
              <strong>{message.customerName}</strong>
              <p className="mt-1 text-sm text-steel">{message.message}</p>
              <p className="mt-2 text-sm text-steel">建议回复：{message.suggestedReply ?? "待生成"}</p>
              <CustomerMessageButtons messageId={message.id} />
            </div>
            <span className="text-sm font-semibold text-accent">{categoryLabel[message.category] ?? message.category}</span>
            <span className="status-chip w-fit md:justify-self-end">{message.status}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
