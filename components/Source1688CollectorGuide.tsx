"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

type UserForShell = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

type CollectedProduct = {
  id: string;
  title: string;
  image: string;
  sku: string;
  skus: Array<{ skuId: string; price: number; stock?: number; attributes: Record<string, string> }>;
  price: number;
  attributes: Array<{ key: string; value: string }>;
  productUrl: string;
};

export function Source1688CollectorGuide({ user }: { user: UserForShell }) {
  const [source, setSource] = useState<"ozon" | "1688">("1688");
  const [productUrl, setProductUrl] = useState("");
  const [result, setResult] = useState<CollectedProduct | null>(null);
  const [sourceProductId, setSourceProductId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function collectProduct() {
    const trimmed = productUrl.trim();
    if (!trimmed || pending || source !== "1688") return;
    setError("");
    setResult(null);
    setSourceProductId("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/sources/1688/collect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productUrl: trimmed })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.error || "1688 商品采集失败。");
        }
        setResult(data.product);
        setSourceProductId(data.sourceProductId || "");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "1688 商品采集失败。");
      }
    });
  }

  return (
    <AppShell title="商品采集" eyebrow="Source Collector" user={user}>
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-cotton p-5 shadow-sm">
        <div className="absolute right-0 top-0 h-36 w-36 border-l border-line bg-[linear-gradient(135deg,rgba(177,107,44,0.18),transparent)]" />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">真实数据源</p>
        <h3 className="mt-2 font-display text-4xl">Ozon / 1688 商品采集</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          1688 采集只调用阿里开放平台 OpenAPI。未配置真实 App Key、App Secret、Access Token 时会直接报错，不返回 mock 或占位商品。
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">开始采集</h3>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">数据源</span>
              <select className="field" value={source} onChange={(event) => setSource(event.target.value as "ozon" | "1688")}>
                <option value="ozon">Ozon</option>
                <option value="1688">1688</option>
              </select>
            </label>

            {source === "ozon" ? (
              <div className="rounded-xl border border-line bg-rail p-4 text-sm leading-6 text-steel">
                Ozon 商品采集已在市场研究页运行。
                <Link href="/research/ozon" className="ml-2 inline-flex items-center gap-1 font-semibold text-accent underline">
                  前往 Ozon 市场研究 <ExternalLink size={13} />
                </Link>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">1688 商品链接</span>
                  <input
                    className="field"
                    value={productUrl}
                    onChange={(event) => setProductUrl(event.target.value)}
                    placeholder="https://detail.1688.com/offer/779353832297.html"
                  />
                </label>
                <button className="btn-primary w-full" onClick={collectProduct} disabled={!productUrl.trim() || pending}>
                  {pending ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                  {pending ? "采集中…" : "开始采集"}
                </button>
              </>
            )}
          </div>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">采集结果</h3>
          {!result ? (
            <div className="mt-5 rounded-xl border border-dashed border-line p-10 text-center text-sm text-steel">
              采集成功后会展示标题、主图、SKU、价格和属性，并写入 source_products。
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex gap-4">
                {result.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.image} alt={result.title} className="h-28 w-28 rounded-xl border border-line object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-xl border border-line text-steel">无主图</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-steel">SourceProduct: {sourceProductId}</p>
                  <h4 className="mt-1 line-clamp-3 text-lg font-semibold text-ink">{result.title}</h4>
                  <p className="mt-2 text-sm text-steel">SKU: {result.sku || "—"}</p>
                  <p className="text-sm text-steel">价格: {result.price > 0 ? "¥" + result.price.toFixed(2) : "—"}</p>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-rail p-4">
                <p className="text-sm font-semibold text-ink">属性</p>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  {result.attributes.length ? result.attributes.map((item, index) => (
                    <div key={index} className="rounded-lg bg-white px-3 py-2">
                      <span className="font-medium text-ink">{item.key || "属性"}</span>
                      <span className="ml-2 text-steel">{item.value || "—"}</span>
                    </div>
                  )) : <p className="text-steel">OpenAPI 未返回属性。</p>}
                </div>
              </div>
              <a href={result.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent underline">
                查看 1688 原商品 <ExternalLink size={13} />
              </a>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
