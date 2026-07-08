"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Search, AlertCircle, Package } from "lucide-react";
import type { Source1688Product } from "@/lib/apify/1688";

type TokenSource =
  | "seller_integration"
  | "seller_ozon_market_integration"
  | "admin_global_integration"
  | "admin_ozon_market_integration"
  | "env"
  | "missing";

type ImportedProductRef = {
  sourceProductId: string;
  importedProductId: string | null;
};

type ImportState = {
  // sourceProductId -> 状态
  [sourceProductId: string]: "importing" | "done" | "error";
};

export function Source1688Console({
  configured,
  tokenSource,
  importedProducts
}: {
  configured: boolean;
  tokenSource: TokenSource;
  importedProducts: ImportedProductRef[];
}) {
  const router = useRouter();
  const importedMap = new Map(importedProducts.map((item) => [item.sourceProductId, item.importedProductId]));
  const [keyword, setKeyword] = useState("");
  const [products, setProducts] = useState<Source1688Product[]>([]);
  const [searching, startSearchTransition] = useTransition();
  const [importStates, setImportStates] = useState<ImportState>({});
  // 导入成功后新增的 productId（用于跳转提示）
  const [lastImportedProductId, setLastImportedProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleSearch() {
    const trimmed = keyword.trim();
    if (!trimmed || searching) return;
    setError(null);
    setInfo(null);
    setProducts([]);

    startSearchTransition(async () => {
      try {
        const res = await fetch("/api/sources/1688/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keyword: trimmed })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `搜索失败 (HTTP ${res.status})`);
        }
        setProducts(data.products || []);
        setInfo(`已返回 ${(data.products || []).length} 个真实 1688 商品。`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "搜索失败。");
      }
    });
  }

  function handleImport(product: Source1688Product) {
    const key = product.id;
    if (importStates[key] === "importing" || importStates[key] === "done") return;
    if (importedMap.has(key)) return; // 已导入

    setImportStates((prev) => ({ ...prev, [key]: "importing" }));
    setError(null);

    fetch("/api/sources/1688/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `导入失败 (HTTP ${res.status})`);
        }
        setImportStates((prev) => ({ ...prev, [key]: "done" }));
        setLastImportedProductId(data.productId);
        // 刷新 server page 以更新 importedMap
        router.refresh();
      })
      .catch((e) => {
        setImportStates((prev) => ({ ...prev, [key]: "error" }));
        setError(e instanceof Error ? e.message : "导入失败。");
      });
  }

  return (
    <div className="space-y-5">
      {/* ── 配置状态提示 ── */}
      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">1688 Apify Token 未配置</p>
            <p className="mt-1 text-amber-800">
              请先到 <Link href="/integrations" className="underline">API 接入中心</Link>
              {" "}填写 1688 / Apify Token（source_1688 类型）。已有 Ozon Market Apify Token 会自动复用；
              也可以在 .env 设置 <code>APIFY_TOKEN</code>。
              未配置前不会返回任何假商品。
            </p>
          </div>
        </div>
      )}

      {/* ── 搜索框 ── */}
      <div className="rounded-lg border border-clay bg-parchment p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-steel">1688 关键词（中文）</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="例如：双肩包 / 充电宝 / 蓝牙耳机"
              className="w-full rounded-md border border-clay bg-white px-3 py-2 text-sm text-earth placeholder:text-steel/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!keyword.trim() || searching || !configured}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                采集中…
              </>
            ) : (
              <>
                <Search size={15} />
                搜索 1688
              </>
            )}
          </button>
        </div>
        {configured && (
          <p className="mt-2 text-xs text-steel">
            数据源：Apify Actor <code>devcake/1688-com-products-scraper</code>
            （token 来源：{
              tokenSource === "seller_integration"
                ? "账号 1688 集成"
                : tokenSource === "seller_ozon_market_integration"
                  ? "账号 Ozon Market 集成复用"
                  : tokenSource === "admin_global_integration"
                    ? "管理员 1688 全局"
                    : tokenSource === "admin_ozon_market_integration"
                      ? "管理员 Ozon Market 全局复用"
                      : tokenSource === "env"
                        ? "环境变量"
                        : "未配置"
            }）
          </p>
        )}
      </div>

      {/* ── 消息条 ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {info}
        </div>
      )}

      {/* ── 结果表 ── */}
      {products.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-clay bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-clay bg-parchment text-left text-xs uppercase tracking-wider text-steel">
                <tr>
                  <th className="px-3 py-2.5 font-medium">图片</th>
                  <th className="px-3 py-2.5 font-medium">标题</th>
                  <th className="px-3 py-2.5 text-right font-medium">价格</th>
                  <th className="px-3 py-2.5 font-medium">供应商</th>
                  <th className="px-3 py-2.5 text-right font-medium">销量</th>
                  <th className="px-3 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {products.map((product) => {
                  const alreadyImported = importedMap.has(product.id);
                  const state = importStates[product.id];
                  const isImporting = state === "importing";
                  const isDone = state === "done" || alreadyImported;
                  return (
                    <tr key={product.id} className="hover:bg-rail/40">
                      <td className="px-3 py-2.5">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image}
                            alt={product.title}
                            className="h-12 w-12 rounded border border-clay object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded border border-clay text-steel">
                            <Package size={16} />
                          </div>
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2.5">
                        <p className="line-clamp-2 text-earth" title={product.title}>{product.title}</p>
                        {product.rating > 0 && (
                          <p className="mt-0.5 text-xs text-steel">评分 {product.rating.toFixed(1)}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-earth">
                        {product.price > 0 ? `¥${product.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-earth" title={product.supplier}>
                          {product.supplier || "—"}
                        </p>
                        {product.supplierLevel && (
                          <p className="text-xs text-steel">{product.supplierLevel}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-steel">
                        {product.sales > 0 ? product.sales.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={13} />
                            已导入
                          </span>
                        ) : isImporting ? (
                          <span className="inline-flex items-center gap-1 text-xs text-steel">
                            <Loader2 size={13} className="animate-spin" />
                            导入中
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImport(product)}
                            disabled={!configured}
                            className="rounded-md border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                          >
                            导入
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 导入后引导：进入商品制作 ── */}
      {lastImportedProductId && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm">
          <div className="text-emerald-900">
            <p className="font-medium">已加入商品制作。</p>
            <p className="mt-0.5 text-emerald-800">下一步可进入商品详情生成 Ozon Listing（标题/描述/属性/SEO）。</p>
          </div>
          <Link
            href={`/products/${lastImportedProductId}`}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            去优化
          </Link>
        </div>
      )}

      {/* ── 空状态 ── */}
      {products.length === 0 && !searching && configured && !error && (
        <div className="rounded-lg border border-dashed border-clay p-10 text-center text-sm text-steel">
          输入中文关键词搜索真实 1688 商品。结果可直接加入商品制作，再生成 Ozon 上架资料。
        </div>
      )}
    </div>
  );
}
