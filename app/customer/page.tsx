import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCustomerReply, sendCustomerReply, syncMockCustomerMessages } from "./actions";

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
    <AppShell title="客服助手" eyebrow="Customer Assistant" user={user}>
      <section className="ledger-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line bg-rail/45 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-3xl">Ozon 消息列表</h3>
            <p className="mt-1 text-sm text-steel">AI回复建议、消息分类、差评/退款/库存提醒为基础功能，不消耗 AI额度。当前不接真实 Ozon 消息接口。</p>
          </div>
          <form action={syncMockCustomerMessages}>
            <button className="btn-primary">同步 mock 消息</button>
          </form>
        </div>
        {messages.length === 0 && <p className="p-5 text-sm text-steel">暂无客服消息。后续接入 Ozon 消息同步后显示。</p>}
        {messages.map((message) => (
          <div key={message.id} className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 md:grid-cols-[1fr_160px_160px]">
            <div>
              <strong>{message.customerName}</strong>
              <p className="mt-1 text-sm text-steel">{message.message}</p>
              <p className="mt-2 text-sm text-steel">建议回复：{message.suggestedReply ?? "待生成"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={generateCustomerReply.bind(null, message.id)}>
                  <button className="btn-secondary px-3 py-2 text-xs">AI回复建议</button>
                </form>
                <form action={sendCustomerReply.bind(null, message.id)}>
                  <button className="btn-primary px-3 py-2 text-xs">一键发送回复</button>
                </form>
              </div>
            </div>
            <span className="text-sm text-steel">{categoryLabel[message.category] ?? message.category}</span>
            <span className="text-sm text-steel md:text-right">{message.status}</span>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
