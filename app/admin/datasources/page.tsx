import { Database } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";
import { readPublicConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

function sourceStatus(input: {
  secretEncrypted?: string | null;
  publicConfig?: unknown;
  status?: string;
  lastCheckedAt?: Date | null;
  requiredFields?: string[];
}) {
  const publicConfig = readPublicConfig(input.publicConfig as never);
  const hasRequiredPublicFields = (input.requiredFields || []).every((field) => Boolean(publicConfig[field]));
  const configured = Boolean(input.secretEncrypted) && hasRequiredPublicFields;
  if (!configured) return "未配置";
  if (input.status === "error") return "异常";
  if (input.lastCheckedAt && input.status === "configured") return "在线";
  return "已配置";
}

export default async function AdminDatasourcesPage() {
  const user = await requireAdminUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ozonCalls, ozonFailed, total1688, totalWb, ozonMarketIntegration, source1688Integration] = await Promise.all([
    prisma.taskLog.count({ where: { type: "research" } }),
    prisma.taskLog.count({ where: { type: "research", status: "failed" } }),
    prisma.taskLog.count({ where: { type: "collect" } }),
    0,
    prisma.apiIntegration.findFirst({ where: { provider: "ozon_market" }, orderBy: { updatedAt: "desc" } }),
    prisma.apiIntegration.findFirst({ where: { provider: "source_1688" }, orderBy: { updatedAt: "desc" } })
  ]);

  const sources = [
    {
      name: "Ozon",
      provider: "Apify Ozon Scraper PRO",
      status: sourceStatus({
        secretEncrypted: ozonMarketIntegration?.secretEncrypted,
        publicConfig: ozonMarketIntegration?.publicConfig,
        status: ozonMarketIntegration?.status,
        lastCheckedAt: ozonMarketIntegration?.lastCheckedAt,
        requiredFields: ["actorId"]
      }),
      calls: ozonCalls,
      failed: ozonFailed,
      failRate: ozonCalls ? Math.round((ozonFailed / ozonCalls) * 100) + "%" : "0%"
    },
    {
      name: "1688",
      provider: "阿里开放平台 OpenAPI",
      status: sourceStatus({
        secretEncrypted: source1688Integration?.secretEncrypted,
        publicConfig: source1688Integration?.publicConfig,
        status: source1688Integration?.status,
        lastCheckedAt: source1688Integration?.lastCheckedAt,
        requiredFields: ["appKey", "accessToken"]
      }),
      calls: total1688,
      failed: 0,
      failRate: "—"
    },
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
