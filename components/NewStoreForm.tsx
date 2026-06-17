"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/Toast";

export function NewStoreForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

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

    toast("success", "店铺已绑定，正在跳转…");
    router.push("/stores");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="ledger-card max-w-3xl p-5 md:p-7">
      <div className="border-b border-line pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Ozon Credentials</p>
        <h3 className="mt-2 font-display text-3xl">绑定 Ozon 跨境店铺</h3>
        <p className="mt-2 text-sm leading-6 text-steel">填写 Ozon Seller API 后台生成的 Client ID 和 API Key。保存前会先校验接口是否能连通。</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold">店铺名称</span>
          <input className="field" name="name" placeholder="Ozon Growth Store" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Ozon Client ID</span>
          <input className="field" name="ozonClientId" placeholder="123456" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Ozon API Key</span>
          <input className="field" name="apiKey" type="password" placeholder="API Key" required />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold">店铺标识（可选）</span>
          <input className="field" name="ozonStoreId" placeholder="OECON / Ozon Growth Store" />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-rust/40 bg-rust/10 p-3 text-sm text-rust">{error}</p>
      )}

      <button className="btn-primary mt-6" disabled={saving}>
        {saving && <Loader2 size={17} style={{ animation: "spin 0.8s linear infinite" }} />}
        <Save size={17} />
        {saving ? "校验中…" : "保存店铺"}
      </button>
    </form>
  );
}
