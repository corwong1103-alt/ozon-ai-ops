"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";

export function AuthPanel({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Authentication failed.");
      setLoading(false);
      return;
    }

    const data = await response.json();
    router.push(data.redirectTo || "/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.12fr_0.88fr]">
      <section className="flex min-h-[44vh] flex-col justify-between bg-ink p-7 text-paper md:p-12">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center border border-paper/25">
            <KeyRound size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-paper/55">Ozon AI Ops</p>
            <p className="font-display text-2xl">跨境运营台</p>
          </div>
        </div>

        <div className="max-w-3xl py-16">
          <span className="stamp border-paper/40 text-paper">Private SaaS</span>
          <h1 className="mt-7 font-display text-5xl leading-tight md:text-7xl">
            AI 驱动的 Ozon 跨境运营工作台。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-paper/68">
            非公开注册，账号需要管理员审核开通。先搭建真实登录、权限、数据库和页面框架，运营模块后续逐步接入。
          </p>
        </div>

        <div className="grid gap-3 border-t border-paper/15 pt-5 text-sm text-paper/60 md:grid-cols-3">
          <span>PostgreSQL + Prisma</span>
          <span>审核授权</span>
          <span>额度与任务模型</span>
        </div>
      </section>

      <section className="flex items-center justify-center p-5 md:p-10">
        <form onSubmit={handleSubmit} className="ledger-card w-full max-w-md p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rust">{mode === "login" ? "Login" : "Register"}</p>
          <h2 className="mt-3 font-display text-4xl">{mode === "login" ? "进入运营台" : "创建账号"}</h2>

          <div className="mt-8 space-y-4">
            {mode === "register" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">姓名</span>
                <input className="field" name="name" placeholder="运营负责人" />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">邮箱</span>
              <input className="field" name="email" type="email" placeholder="operator@example.com" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">密码</span>
              <input className="field" name="password" type="password" placeholder="至少 8 位" required />
            </label>
          </div>

          {error && <p className="mt-4 border border-rust/40 bg-rust/10 p-3 text-sm text-rust">{error}</p>}

          <button className="btn-primary mt-6 w-full" disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            <ArrowRight size={17} />
          </button>

          <p className="mt-5 text-sm text-steel">
            {mode === "login" ? "还没有账号？" : "已经有账号？"}
            <Link className="ml-2 font-bold text-ink underline" href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "注册" : "登录"}
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
