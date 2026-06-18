import { Database } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminDatasourcesPage() {
  const user = await requireAdminUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ozonCalls, ozonFailed, total1688, totalWb] = await Promise.all([
    prisma.taskLog.count({ where: { type: "research" } }),
    prisma.taskLog.count({ where: { type: "research", status: "failed" } }),
    prisma.taskLog.count({ where: { type: "collect" } }),
    0
  ]);

  const sources = [
    { name: "Ozon", provider: "Apify Ozon Scraper PRO", status: "在线", calls: ozonCalls, failed: ozonFailed, failRate: ozonCalls ? `${Math.round((ozonFailed / ozonCalls) * 100)}%` : "0%" },
    { name: "1688", provider: "阿里开放平台（待接入）", status: "筹备中", calls: total1688, failed: 0, failRate: "—" },
    { name: "Wildberries", provider: "待接入", status: "筹备中", calls: totalWb, failed: 0, failRate: "—" }
  ];

  return (
    <AppShell title="数据源中心" eyebrow="Admin · Datasources" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">市场数据源管理</p>
            <h3>Ozon / 1688 / Wildberries 三大市场数据源的状态与调用监控。</h3>
          </div>
        </div>
        <div className="dashboard-kpi-grid">
          {sources.map((s) => (
            <div key={s.name} className="dashboard-kpi-card">
              <div className="dashboard-kpi-head"><Database size={16} /><span>{s.name}</span></div>
              <p>{s.provider}</p>
              <div className="dashboard-kpi-value"><strong>{s.status}</strong></div>
              <p className="text-xs text-steel">调用 {s.calls} 次 · 失败 {s.failed} · 失败率 {s.failRate}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-steel">V3 P2 阶段接入 1688 与 Wildberries 真实数据源。Ozon 已通过 Apify 接通。</p>
      </section>
    </AppShell>
  );
}
