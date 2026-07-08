import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";
import { LogoutForm } from "@/components/LogoutForm";

export function AccountStatePage({
  title,
  description,
  tone = "pending"
}: {
  title: string;
  description: string;
  tone?: "pending" | "blocked";
}) {
  const Icon = tone === "pending" ? Clock : ShieldAlert;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-12">
      <section className="ledger-card max-w-xl p-7 text-center md:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-md border border-line bg-white">
          <Icon className={tone === "pending" ? "text-alert" : "text-rust"} size={25} />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-accent">Ozon AI Ops</p>
        <h1 className="mt-3 font-display text-4xl text-ink">{title}</h1>
        <p className="mt-4 leading-7 text-steel">{description}</p>
        <LogoutForm className="mt-7" />
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-accent">
          返回登录页
        </Link>
      </section>
    </main>
  );
}
