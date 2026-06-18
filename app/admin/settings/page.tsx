import { Settings } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const user = await requireAdminUser();

  const settings = [
    { label: "平台名称", value: "Ozon AI Ops" },
    { label: "部署环境", value: "阿里云香港 ECS · Docker" },
    { label: "数据库", value: "PostgreSQL · Prisma" },
    { label: "AI Provider", value: "阿里云百炼 / DashScope" },
    { label: "市场数据源", value: "Apify Ozon Scraper PRO" },
    { label: "反向代理", value: "Nginx" }
  ];

  return (
    <AppShell title="系统设置" eyebrow="Admin · Settings" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">平台配置</p>
            <h3>系统级配置与运行环境信息。</h3>
          </div>
        </div>
        <div className="ledger-card overflow-hidden">
          {settings.map((s) => (
            <div key={s.label} className="grid grid-cols-12 gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0">
              <span className="col-span-4 text-steel">{s.label}</span>
              <strong className="col-span-8">{s.value}</strong>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-steel flex items-center gap-1"><Settings size={12} /> V3 后续开放域名、HTTPS、CDN、OSS 等配置项。</p>
      </section>
    </AppShell>
  );
}
