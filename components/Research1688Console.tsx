"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Grid3X3, List, Search, TrendingUp, DollarSign, Filter } from "lucide-react";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { useToast } from "@/components/Toast";
import { usePersistentState } from "@/lib/usePersistentState";

type Product = {
  id: string;
  title: string;
  image: string;
  images: string[];
  price: number;
  supplier: string;
  sales: number;
  rating: number;
  productUrl: string;
};

type ViewMode = "table" | "card";
type SortMode = "sales" | "price" | "rating" | "newest";
type TimeRange = "30d" | "90d" | "365d";

export function Research1688Console() {
  const router = useRouter();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchKeyword, setSearchKeyword] = usePersistentState("rc_search", "", { ttlMs: 30 * 60 * 1000 });
  const [sortMode, setSortMode] = useState<SortMode>("sales");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [products, setProducts] = usePersistentState<Product[]>("rc_products", [], {
    ttlMs: 30 * 60 * 1000,
    maxLength: 50
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchElapsed, setSearchElapsed] = useState(0);

  useEffect(() => {
    if (!loading) { setSearchElapsed(0); return; }
    const interval = setInterval(() => { setSearchElapsed((p) => p + 1); }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const toggleProduct = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(products.map((p) => p.id)));
  }, [products]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchKeyword.trim()) return;
    setLoading(true);
    setSearchElapsed(0);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/sources/1688/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: searchKeyword }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (e: any) {
      if (e.name === "AbortError") toast("error", "1688 搜索超时（30s），请重试。");
      else toast("error", "1688 搜索失败，请稍后重试。");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [searchKeyword, toast]);

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return;
    setImporting(true);
    let success = 0;
    for (const id of Array.from(selected)) {
      try {
        const res = await fetch("/api/sources/1688/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceProductId: id }),
        });
        const data = await res.json();
        if (data.ok) success++;
      } catch { /* continue */ }
    }
    toast("success", `已导入 ${success}/${selected.size} 件商品到商品制作`);
    setSelected(new Set());
    router.refresh();
    setImporting(false);
  }, [selected, toast, router]);

  return (
    <div className="space-y-6">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-steel">关键词搜索</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
              <input
                className="field pl-9"
                placeholder="搜索 1688 商品..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button className="btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "搜索中…" : "搜索"}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-steel">排序</label>
          <select className="field" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="sales">销量排序</option>
            <option value="price">价格排序</option>
            <option value="rating">评分排序</option>
            <option value="newest">最新排序</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-steel">最低价</label>
            <input className="field w-28" placeholder="¥0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          </div>
          <span className="pb-2 text-steel">—</span>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-steel">最高价</label>
            <input className="field w-28" placeholder="¥9999" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between rounded-lg border border-clay bg-parchment/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-steel">
            {products.length > 0 ? `${products.length} 件商品` : "输入关键词开始搜索"}
          </span>
          {selected.size > 0 && (
            <span className="text-sm font-semibold text-earth">{selected.size} 件已选</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button className="btn-secondary text-xs" onClick={clearSelection}>取消全选</button>
              <button className="btn-primary text-xs" onClick={handleImport} disabled={importing}>
                {importing ? "导入中…" : `Add To Product Pool (${selected.size})`}
              </button>
            </>
          )}
          {products.length > 0 && selected.size === 0 && (
            <button className="btn-secondary text-xs" onClick={selectAll}>全选</button>
          )}
          <div className="ml-3 flex rounded-md border border-clay bg-white">
            <button
              className={`px-2.5 py-1.5 ${viewMode === "table" ? "bg-rail text-earth" : "text-steel"}`}
              onClick={() => setViewMode("table")}
            >
              <List size={15} />
            </button>
            <button
              className={`px-2.5 py-1.5 ${viewMode === "card" ? "bg-rail text-earth" : "text-steel"}`}
              onClick={() => setViewMode("card")}
            >
              <Grid3X3 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Product Grid / Table */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-steel">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm font-medium">正在搜索 1688...</p>
          <p className="mt-1 text-xs text-steel/60">关键词：{searchKeyword} · 已搜索 {searchElapsed}s · 预计 15~30s</p>
          <p className="mt-2 text-[11px] text-steel/40">后台调用 Apify 1688 Scraper，页面不会卡顿</p>
        </div>
      )}
      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-steel">
          <TrendingUp size={40} className="mb-3 text-steel/40" />
          <p className="text-sm">从上方搜索 1688 商品</p>
          <p className="mt-1 text-xs text-steel/60">支持关键词搜索、价格区间筛选、销量/价格/评分排序</p>
        </div>
      )}
      {!loading && products.length > 0 && viewMode === "card" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`group relative rounded-xl border bg-white p-3 transition-all hover:shadow-md cursor-pointer ${
                selected.has(product.id) ? "border-accent ring-2 ring-accent/20" : "border-clay"
              }`}
              onClick={() => toggleProduct(product.id)}
            >
              <div className="absolute right-3 top-3 z-10">
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  className="h-4 w-4 rounded accent-accent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <ReliableProductImage
                images={product.images.length ? product.images : [product.image]}
                alt={product.title}
                className="mb-3 aspect-square w-full rounded-lg object-cover"
                emptyLabel="无图"
              />
              <h3 className="line-clamp-2 text-sm font-medium leading-snug text-earth">{product.title}</h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-earth">¥{product.price.toFixed(2)}</span>
                <span className="text-xs text-steel">销量 {product.sales}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-steel">
                <span>{product.supplier}</span>
                <span>·</span>
                <span>⭐ {product.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && products.length > 0 && viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-clay bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-clay bg-rail/60 text-left">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === products.length}
                    onChange={() => selected.size === products.length ? clearSelection() : selectAll()}
                    className="h-4 w-4 rounded accent-accent"
                  />
                </th>
                <th className="px-3 py-3 w-16">图片</th>
                <th className="px-3 py-3">标题</th>
                <th className="px-3 py-3 w-24">价格</th>
                <th className="px-3 py-3 w-20">销量</th>
                <th className="px-3 py-3 w-24">供应商</th>
                <th className="px-3 py-3 w-16">评分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clay">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className={`cursor-pointer transition-colors hover:bg-rail/40 ${
                    selected.has(product.id) ? "bg-accent/5" : ""
                  }`}
                  onClick={() => toggleProduct(product.id)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 rounded accent-accent"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <ReliableProductImage
                      images={product.images.length ? product.images : [product.image]}
                      alt={product.title}
                      className="h-12 w-12 rounded-lg object-cover"
                      emptyLabel="-"
                    />
                  </td>
                  <td className="px-3 py-3 max-w-xs truncate font-medium">{product.title}</td>
                  <td className="px-3 py-3 font-semibold">¥{product.price.toFixed(2)}</td>
                  <td className="px-3 py-3">{product.sales}</td>
                  <td className="px-3 py-3 text-xs text-steel">{product.supplier}</td>
                  <td className="px-3 py-3">⭐ {product.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
