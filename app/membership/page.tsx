import Link from "next/link";
import { Coins, Crown, History, Wallet } from "lucide-react";
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

export default async function MembershipPage() {
  const user = await requireApprovedUser();
  const imageCredits = user.credits?.imageCredits ?? 0;
  const videoCredits = user.credits?.videoCredits ?? 0;

  const consumptionLogs = await prisma.taskLog.findMany({
    where: { userId: user.id, creditCost: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { product: true }
  });

  return (
    <AppShell title="会员中心" eyebrow="Membership" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">套餐与额度</p>
            <h3>查看当前套餐、AI 额度、消耗与充值记录。</h3>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-head"><Crown size={16} /><span>当前套餐</span></div>
            <div className="dashboard-kpi-value"><strong>{planLabel[user.plan]}</strong></div>
            <p>到期：{user.expiresAt ? user.expiresAt.toLocaleDateString("zh-CN") : "未设到期"}</p>
          </div>
          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-head"><Coins size={16} /><span>商品图额度</span></div>
            <div className="dashboard-kpi-value"><strong>{imageCredits}</strong><span>张</span></div>
            <p>AI 生图消耗</p>
          </div>
          <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-head"><Coins size={16} /><span>视频额度</span></div>
            <div className="dashboard-kpi-value"><strong>{videoCredits}</strong><span>条</span></div>
            <p>AI 视频消耗</p>
          </div>
          <Link href="/credits" className="dashboard-kpi-card">
            <div className="dashboard-kpi-head"><Wallet size={16} /><span>额度明细</span></div>
            <p>查看完整额度记录</p>
          </Link>
        </div>

        <section className="dashboard-panel tasks mt-5">
          <div className="dashboard-panel-title">
            <span><History size={14} className="inline mr-1" />消耗记录</span>
          </div>
          <div className="dashboard-task-list">
            {consumptionLogs.length === 0 && <p className="dashboard-empty">暂无 AI 消耗记录。</p>}
            {consumptionLogs.map((log) => (
              <div key={log.id} className="dashboard-task-row">
                <Coins size={14} />
                <strong>{log.type}</strong>
                <span>-{log.creditCost}</span>
                <p>{log.product?.title?.slice(0, 30) || log.message.slice(0, 30)}</p>
                <time>{formatTime(log.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
        <p className="mt-6 text-xs text-steel">充值请联系管理员。V3 后续开放在线充值与套餐升级。</p>
      </section>
    </AppShell>
  );
}
