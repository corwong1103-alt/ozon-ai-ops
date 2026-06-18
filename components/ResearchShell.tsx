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
    <AppShell title="Research Center" eyebrow="发现市场机会，筛选商品并导入商品池" user={user}>
      {/* Tab Bar */}
      <div className="mb-6 flex items-center gap-1 rounded-lg bg-rail/60 p-1 w-fit">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled;
          const TabIcon = tab.icon;

          if (isDisabled || !tab.href) {
            return (
              <span
                key={tab.key}
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-steel/50 cursor-not-allowed select-none"
                title={tab.description}
              >
                <TabIcon size={15} />
                {tab.label}
                <span className="text-[10px] uppercase tracking-wider text-steel/40 ml-0.5">Soon</span>
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
                  : "text-steel hover:text-earth hover:bg-white/60"
              }`}
            >
              <TabIcon size={15} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </AppShell>
  );
}
