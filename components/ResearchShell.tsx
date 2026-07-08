"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Search, Globe, Package } from "lucide-react";

type ShellUser = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

type TabDef = {
  key: string;
  label: string;
  href: string;
  icon: typeof Search;
  description: string;
  disabled?: boolean;
};

const TABS: TabDef[] = [
  { key: "1688", label: "1688", href: "/research/1688", icon: Package, description: "1688 商品采集与选品" },
  { key: "ozon", label: "Ozon", href: "/research/ozon", icon: Globe, description: "Ozon 市场调研与竞争对手分析" },
  { key: "wildberries", label: "Wildberries", href: "", icon: Search, description: "Coming Soon", disabled: true },
] as const;

export function ResearchShell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname.startsWith(t.href))?.key || "1688";

  return (
    <AppShell title="发现商品" eyebrow="STEP 1 / 找到值得制作的真实商品" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Source</span>
            <h2>先找到一个真实商品</h2>
            <p>选择 1688 或 Ozon 来源，筛选后加入商品制作。这里不展示系统任务概念，只帮你判断下一件商品值不值得做。</p>
          </div>
          <Link href="/factory" className="btn-secondary">查看制作中</Link>
        </div>

        <div className="flex w-fit items-center gap-1 rounded-lg bg-rail/60 p-1">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            const isDisabled = tab.disabled;
            const TabIcon = tab.icon;

            if (isDisabled || !tab.href) {
              return (
                <span
                  key={tab.key}
                  className="inline-flex cursor-not-allowed select-none items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-steel/50"
                  title={tab.description}
                >
                  <TabIcon size={15} />
                  {tab.label}
                  <span className="ml-0.5 text-[10px] text-steel/40">稍后</span>
                </span>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white text-earth shadow-sm"
                    : "text-steel hover:bg-white/60 hover:text-earth"
                }`}
              >
                <TabIcon size={15} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </section>
    </AppShell>
  );
}
