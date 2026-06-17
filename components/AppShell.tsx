import Link from "next/link";
import { Boxes, LogOut, MapPinned, Route } from "lucide-react";
import { mainNavItems } from "@/lib/navigation";

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
  eyebrow: string;
  user?: ShellUser;
}) {
  const visibleItems = mainNavItems.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <div className="min-h-screen" style={{ background: "rgb(var(--sand))" }}>
      {/* ── Sidebar ── */}
      <aside className="sidebar-shell fixed left-0 top-0 hidden h-screen w-56 flex-col border-r lg:flex">
        {/* Brand block */}
        <div className="sidebar-brand bazaar-band shrink-0 p-4 pb-5">
          <div className="flex items-center gap-3">
            <div className="sidebar-logo grid h-10 w-10 place-items-center rounded-lg">
              <Boxes size={18} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: "rgb(var(--wheat) / 0.5)" }}>
                Ozon AI Ops
              </p>
              <h1
                className="text-lg leading-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em"
                }}
              >
                边贸中枢
              </h1>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs" style={{ color: "rgb(var(--wheat) / 0.55)" }}>
            <span className="sidebar-location inline-flex items-center gap-2 rounded-md px-2.5 py-2">
              <MapPinned size={13} style={{ color: "rgb(var(--amber))" }} />
              乌鲁木齐
            </span>
            <span className="sidebar-location inline-flex items-center gap-2 rounded-md px-2.5 py-2">
              <Route size={13} style={{ color: "rgb(var(--sage))" }} />
              Ozon
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-nav-link group relative flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold"
              >
                <span className="sidebar-nav-icon grid h-8 w-8 place-items-center rounded-md">
                  <Icon size={15} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Geometric pattern strip */}
        <div className="sidebar-pattern shrink-0" />

        {/* User block */}
        <div className="sidebar-user m-3 rounded-xl p-4">
          <p className="text-sm font-semibold" style={{ color: "rgb(var(--wheat))" }}>
            {user?.email ?? "未登录"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "rgb(var(--wheat) / 0.48)" }}>
            {user ? `${user.status} · ${user.plan}` : "请先登录"}
          </p>
          <form action="/api/auth/logout" method="post" className="mt-3">
            <button className="sidebar-logout-btn inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm">
              <LogOut size={14} />
              退出登录
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="lg:pl-56">
        <header className="topbar sticky top-0 z-20 border-b px-5 py-2.5 backdrop-blur-xl md:px-7">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">{eyebrow}</p>
              <h2
                className="mt-0.5 text-2xl font-black tracking-[-0.03em] md:text-3xl"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "rgb(var(--earth))"
                }}
              >
                {title}
              </h2>
            </div>
            <div className="topbar-badge hidden rounded-md border px-4 py-2 text-xs font-bold shadow-sm md:block">
              {user?.role === "admin" ? "乌鲁木齐 · Ozon · 香港 ECS" : "乌鲁木齐 · Ozon · 边贸运营"}
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="mx-auto mt-4 flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="mobile-nav-link inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold"
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-4 md:px-7">{children}</div>
      </main>
    </div>
  );
}
