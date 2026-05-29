"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

export function NewStoreForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "店铺绑定失败。");
      setSaving(false);
      return;
    }

    router.push("/stores");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card max-w-3xl p-5 md:p-7">
      <div className="border-b border-line pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Ozon Credentials</p>
        <h3 className="mt-2 font-display text-3xl">绑定 Ozon 跨境店铺</h3>
        <p className="mt-2 text-sm leading-6 text-steel">当前阶段只保存真实数据结构。生产环境应进一步接入密钥加密与 Ozon API 连通性校验。</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold">店铺名称</span>
          <input className="field" name="name" placeholder="Ozon Growth Store" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Ozon 跨境店铺 ID</span>
          <input className="field" name="ozonStoreId" placeholder="OZON-CB-90321" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Ozon API Key</span>
          <input className="field" name="apiKey" placeholder="ozon_live_key_xxx" required />
        </label>
      </div>

      {error && <p className="mt-4 rounded-md border border-rust/40 bg-rust/10 p-3 text-sm text-rust">{error}</p>}

      <button className="btn-primary mt-6" disabled={saving}>
        <Save size={17} />
        {saving ? "保存中..." : "保存店铺"}
      </button>
    </form>
  );
}
