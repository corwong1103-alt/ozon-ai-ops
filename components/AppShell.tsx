import Link from "next/link";
import { Boxes } from "lucide-react";
import { adminNavItems, sellerNavItems } from "@/lib/navigation";
import { LogoutForm } from "@/components/LogoutForm";
import { ThemeToggle } from "@/components/ThemeToggle";

type ShellUser = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

export function AppShell({
  children,
  title,
  eyebrow,
  user
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  user?: ShellUser;
}) {
  const visibleItems = user?.role === "admin" ? adminNavItems : sellerNavItems;
  const isSeller = user?.role !== "admin";
  const groupedItems = isSeller
    ? [
        visibleItems.slice(0, 1),
        visibleItems.slice(1, 5),
        visibleItems.slice(5)
      ]
    : [visibleItems];

  return (
    <div className="min-h-screen bg-sand text-earth">
      <aside className="fixed left-0 top-0 hidden h-screen w-60 flex-col border-r border-clay bg-parchment lg:flex">
        <div className="flex items-center gap-2 border-b border-clay px-4 py-4">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent">
            <Boxes size={15} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-earth">Ozon AI Ops</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groupedItems.map((group, index) => (
            <div key={index} className={index > 0 ? "mt-3 border-t border-clay pt-3" : ""}>
              <div className="space-y-0.5">
                {group.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-steel transition-colors hover:bg-rail hover:text-earth"
                    >
                      <Icon size={15} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-clay p-2">
          <div className="px-2.5 py-1.5">
            <p className="truncate text-xs font-medium text-earth">{user?.email ?? "未登录"}</p>
            <p className="text-xs text-steel">{user ? `${user.plan} · ${user.status}` : "请先登录"}</p>
          </div>
          <LogoutForm
            buttonClassName="mt-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-steel transition-colors hover:bg-rail hover:text-earth"
            showIcon
          />
        </div>
      </aside>

      <main className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-clay bg-sand/80 px-6 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div>
              {eyebrow && <p className="text-xs font-medium text-steel">{eyebrow}</p>}
              <h1 className="text-lg font-semibold tracking-tight text-earth">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-clay px-2.5 py-1.5 text-xs font-medium text-steel"
                >
                  <Icon size={13} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
