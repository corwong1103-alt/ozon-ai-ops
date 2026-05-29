import Link from "next/link";
import { Boxes, LogOut } from "lucide-react";
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
    <div className="min-h-screen bg-paper">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-line bg-ink text-paper lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-paper/15 p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-paper/25">
                <Boxes size={20} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-paper/55">Ozon AI Ops</p>
                <h1 className="font-display text-2xl leading-none">跨境运营台</h1>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md border border-transparent px-3 py-3 text-sm text-paper/78 transition hover:border-paper/15 hover:bg-paper/10 hover:text-paper"
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="m-4 rounded-md border border-paper/15 p-4">
            <p className="text-sm font-semibold text-paper">{user?.email ?? "未登录"}</p>
            <p className="mt-1 text-xs text-paper/58">
              {user ? `${user.status} / ${user.plan}` : "请先登录"}
            </p>
            <form action="/api/auth/logout" method="post" className="mt-4">
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-paper/15 px-3 py-2 text-sm text-paper/72 transition hover:bg-paper/10 hover:text-paper">
                <LogOut size={15} />
                退出登录
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="border-b border-line bg-white/88 px-5 py-5 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
              <h2 className="mt-2 font-display text-3xl text-ink md:text-5xl">{title}</h2>
            </div>
            <div className="flex gap-2 lg:hidden">
              <Link href="/dashboard" className="btn-secondary text-sm">
                Dashboard
              </Link>
              <Link href="/stores" className="btn-secondary text-sm">
                店铺
              </Link>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
