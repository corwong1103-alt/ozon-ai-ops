"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { OzonMarketPoolButton, OzonPoolButton } from "@/components/OzonPoolButton";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { useRouter } from "next/navigation";
import { ResearchTaskPoller } from "@/components/ResearchTaskPoller";
import { usePersistentState } from "@/lib/usePersistentState";
import { ozonMarketCategories } from "@/lib/services/ozon-market-categories";
import type { OzonMarketSearchResult } from "@/lib/services/ozon-market";
import type { KeywordExpansionResult } from "@/lib/services/keyword-expander";
import type { ScoredProduct } from "@/lib/services/product-scoring";
import type { OzonProductImport } from "@/lib/services/ozon";

type UserForShell = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

type StoreOption = {
  id: string;
  name: string;
  ozonStoreId: string;
};

const keywordAliases: Record<string, string[]> = {
  hair: ["hair", "волос", "капиксил", "шампун", "сыворот", "生发", "护发"],
  beauty: ["beauty", "красот", "космет", "美妆", "个护"],
  skin: ["skin", "кожа", "лицо", "护肤", "面部"],
  kitchen: ["kitchen", "кухн", "посуда", "厨房"],
  phone: ["phone", "телефон", "смартфон", "手机"],
  baby: ["baby", "дет", "ребен", "母婴", "儿童"]
};

function termsForKeyword(keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return [];
  return [normalized, ...(keywordAliases[normalized] || [])];
}

function termsForCategory(categoryId: string) {
  return ozonMarketCategories.find((item) => item.id === categoryId)?.keywords || [];
}

function matchesSearch(product: OzonProductImport, keyword: string) {
  if (!keyword) return true;
  const text = `${product.name} ${product.offerId} ${product.currency}`.toLowerCase();
  return termsForKeyword(keyword).some((term) => text.includes(term.toLowerCase()));
}

function matchesCategory(product: OzonProductImport, categoryId: string) {
  if (!categoryId) return true;
  const text = `${product.name} ${product.offerId}`.toLowerCase();
  return termsForCategory(categoryId).some((term) => text.includes(term.toLowerCase()));
}

function filteredProducts(
  products: OzonProductImport[],
  searchParams: Record<string, string | string[] | undefined>
) {
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword.trim() : "";
  const sort = searchParams.sort === "price" ? "price" : "default";
  const category = typeof searchParams.category === "string" ? searchParams.category : "";
  const imageOnly = searchParams.imageOnly !== "false";
  const minPrice = typeof searchParams.minPrice === "string" && searchParams.minPrice ? Number(searchParams.minPrice) : undefined;
  const maxPrice = typeof searchParams.maxPrice === "string" && searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined;

  return products
    .filter((product) => matchesSearch(product, keyword))
    .filter((product) => matchesCategory(product, category))
    .filter((product) => !imageOnly || product.images.length > 0)
    .filter((product) => minPrice === undefined || product.price >= minPrice)
    .filter((product) => maxPrice === undefined || product.price <= maxPrice)
    .sort((a, b) => {
      if (sort === "price") return a.price - b.price;
      return Number(b.images.length > 0) - Number(a.images.length > 0);
    });
}

export function OzonResearchConsole({
  user,
  stores,
  selectedStoreId,
  products,
  marketResult,
  keywordExpansion,
  scoredProducts,
  pendingTaskId,
  pendingKeyword,
  mode,
  error,
  searchParams
}: {
  user: UserForShell;
  stores: StoreOption[];
  selectedStoreId?: string;
  products: OzonProductImport[];
  marketResult: OzonMarketSearchResult;
  keywordExpansion?: KeywordExpansionResult;
  scoredProducts?: ScoredProduct[];
  pendingTaskId?: string;
  pendingKeyword?: string;
  mode: "market" | "seller";
  error?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword : "";
  const sort = searchParams.sort === "price" ? "price" : "default";
  const category = typeof searchParams.category === "string" ? searchParams.category : "";
  const imageOnly = searchParams.imageOnly !== "false";
  const minPrice = typeof searchParams.minPrice === "string" ? searchParams.minPrice : "";
  const maxPrice = typeof searchParams.maxPrice === "string" ? searchParams.maxPrice : "";
  const visibleProducts = filteredProducts(products, searchParams);
  const marketProducts = marketResult.products;
  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const imageReadyCount = products.filter((product) => product.images.length > 0).length;

  const [savedMarketProducts, setSavedMarketProducts] = usePersistentState<any[]>("ozon_products", [], {
    ttlMs: 30 * 60 * 1000,
    maxLength: 50,
    userId: user.email
  });
  const [savedResearchTask, setSavedResearchTask] = usePersistentState<{ taskId: string; keyword: string; t: number } | null>("ozon_task", null, {
    ttlMs: 30 * 60 * 1000,
    userId: user.email
  });
  const displayProducts = marketProducts.length > 0 ? marketProducts : savedMarketProducts;
  const marketImageReadyCount = displayProducts.filter((product: any) => (product.images?.length || 0) > 0).length;

  useEffect(() => {
    if (marketProducts.length > 0) setSavedMarketProducts(marketProducts);
  }, [marketProducts, setSavedMarketProducts]);
  useEffect(() => {
    if (pendingTaskId) setSavedResearchTask({ taskId: pendingTaskId, keyword: pendingKeyword || keyword, t: Date.now() });
  }, [pendingTaskId, pendingKeyword, keyword, setSavedResearchTask]);
  const activeResearchTask = pendingTaskId
    ? { taskId: pendingTaskId, keyword: pendingKeyword || keyword || "" }
    : savedResearchTask;

  // Client-side filter controls for market section
  const [marketSort, setMarketSort] = useState("default");
  const [marketMinPriceStr, setMarketMinPriceStr] = useState("");
  const [marketMaxPriceStr, setMarketMaxPriceStr] = useState("");

  const filteredMarketProducts = useMemo(() => {
    const items = scoredProducts?.length ? scoredProducts : displayProducts;
    const minP = marketMinPriceStr ? Number(marketMinPriceStr) : undefined;
    const maxP = marketMaxPriceStr ? Number(marketMaxPriceStr) : undefined;
    return [...items]
      .filter((p) => {
        const price = p.price;
        if (price === undefined) return !minP && !maxP;
        if (minP !== undefined && price < minP) return false;
        if (maxP !== undefined && price > maxP) return false;
        return true;
      })
      .sort((a, b) => {
        if (marketSort === "price") {
          const aP = a.price ?? Infinity;
          const bP = b.price ?? Infinity;
          return aP - bP;
        }
        if (marketSort === "rating") {
          const aR = a.rating ?? 0;
          const bR = b.rating ?? 0;
          return bR - aR;
        }
        return (a.salesRank ?? 0) - (b.salesRank ?? 0);
      });
  }, [marketSort, marketMinPriceStr, marketMaxPriceStr, displayProducts, scoredProducts]);

  return (
    <AppShell title="Ozon 调研" eyebrow="真实商品图" user={user}>
      <section className="research-compact-head">
        <div>
          <p className="section-kicker">Ozon Research · 真实数据边界</p>
          <h3>{mode === "market" ? "全站市场搜索需要真实市场数据源。" : "当前筛选你店铺 API 返回的真实商品。"}</h3>
          <p>
            {mode === "market"
              ? "选择类目或输入关键词后，会请求已配置的 Ozon 市场搜索 API；未配置时不会展示假商品。"
              : "Seller API 只读取已绑定店铺可见商品，适合把真实店铺商品加入商品制作继续处理图片和文案。"}
          </p>
        </div>
        <div className="research-mini-stats">
          <div>
            <span>模式</span>
            <strong>{mode === "market" ? "市场" : "店铺"}</strong>
          </div>
          <div>
            <span>商品</span>
            <strong>{mode === "market" ? marketProducts.length : products.length}</strong>
          </div>
          <div>
            <span>有图</span>
            <strong>{mode === "market" ? marketImageReadyCount : imageReadyCount}</strong>
          </div>
        </div>
      </section>

      <section className="research-mode-tabs">
        <a className={mode === "market" ? "active" : ""} href="/research/ozon?mode=market">Ozon 全站市场搜索</a>
        <a className={mode === "seller" ? "active" : ""} href="/research/ozon?mode=seller">我的店铺 Seller API</a>
      </section>

      {mode === "seller" && stores.length === 0 && (
        <section className="mt-5 border border-line bg-rail p-5">
          <h3 className="font-display text-3xl">先绑定 Ozon API 店铺</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-steel">
            这里需要先到“店铺”页面填入 Ozon Client ID 和 API Key。未绑定前无法证明图片来自真实商品源，所以不会显示任何商品卡片。
          </p>
        </section>
      )}

      {mode === "seller" && error && (
        <section className="mt-5 border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          Ozon API 读取失败：{error}
        </section>
      )}

      {mode === "market" && (
        <>
          <form className="research-filter-bar market">
            <input type="hidden" name="mode" value="market" />
            <label className="block">
              <span>类目</span>
              <select className="field" name="category" defaultValue={category}>
                {ozonMarketCategories.map((item) => (
                  <option key={item.id || "all"} value={item.id}>{item.label} · {item.ruLabel}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span>关键词</span>
              <input className="field" name="keyword" defaultValue={keyword} placeholder="输入中文/英文/俄文关键词，如 serum / 生发 / сыворотка" />
            </label>
            <button className="btn-primary">搜索真实市场商品</button>
          </form>

          {/* 数据源 tab（Ozon / 1688 / Wildberries） */}
          <div className="research-source-tabs">
            <a className="active" href="/research/ozon?mode=market">Ozon</a>
            <a className="disabled" title="1688 数据源待接入（P2 后续）">1688</a>
            <a className="disabled" title="Wildberries 数据源待接入">Wildberries</a>
          </div>

          {/* P2: AI 关键词扩展面板 */}
          {keywordExpansion && (
            <section className="research-ai-expansion">
              <div className="research-ai-expansion-head">
                <strong>AI 关键词扩展</strong>
                <span>Qwen 识别 · 翻译 · 扩展</span>
              </div>
              <div className="research-ai-expansion-body">
                <div>
                  <span>原始词</span>
                  <strong>{keywordExpansion.original}</strong>
                  <em>语种：{keywordExpansion.detectedLanguage}</em>
                </div>
                {keywordExpansion.translatedRu && (
                  <div>
                    <span>俄语翻译</span>
                    <strong>{keywordExpansion.translatedRu}</strong>
                  </div>
                )}
                {keywordExpansion.keywords.filter((k) => k.source === "expanded").length > 0 && (
                  <div>
                    <span>扩展词</span>
                    <div className="research-ai-tags">
                      {keywordExpansion.keywords.filter((k) => k.source === "expanded").map((k) => (
                        <em key={k.keyword}>{k.keyword}</em>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeResearchTask ? (
            <ResearchTaskPoller taskId={activeResearchTask.taskId} keyword={activeResearchTask.keyword || ""} />
          ) : (
            <>
              <div className={`research-source-panel ${marketResult.mode}`}>
                <div>
                  <strong>{marketResult.sourceName}</strong>
                  <p>{marketResult.message}</p>
                </div>
                <a href="/integrations">去配置数据源</a>
              </div>

              {marketProducts.length > 0 && (
                <div className="research-result-bar">
                  <p>结果来自你配置的真实市场数据源。商品图只使用接口返回的真实链接；无图商品不会被允许入池。</p>
                  <span>Top {marketProducts.length}</span>
                </div>
              )}

              {marketProducts.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">排序</span>
                    <select className="field text-xs py-1" value={marketSort} onChange={(e) => setMarketSort(e.target.value)}>
                      <option value="default">默认</option>
                      <option value="price">价格升序</option>
                      <option value="rating">评分降序</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">最低价</span>
                    <input className="field w-24 text-xs py-1" placeholder="RUB" value={marketMinPriceStr} onChange={(e) => setMarketMinPriceStr(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-steel">最高价</span>
                    <input className="field w-24 text-xs py-1" placeholder="RUB" value={marketMaxPriceStr} onChange={(e) => setMarketMaxPriceStr(e.target.value)} />
                  </div>
                  <span className="text-[11px] text-steel/60">{filteredMarketProducts.length} 件</span>
                </div>
              )}

              {filteredMarketProducts.length > 0 && (
              <div className="research-product-grid">
                {filteredMarketProducts.map((product) => {
                  const scores = "scores" in product ? (product as ScoredProduct).scores : null;
                  return (
                  <article key={`${product.productId}_${product.sourceUrl || product.name}`} className="research-product-card">
                    <div className="research-product-media">
                      <ReliableProductImage
                        images={product.images}
                        alt={product.name}
                        className="h-full w-full object-contain"
                        emptyLabel="市场源未返回图片"
                      />
                      <span>{product.salesRank ? `#${product.salesRank}` : `${product.images.length} 图`}</span>
                    </div>
                    <div className="research-product-body">
                      <p>{product.category || "Ozon market"}</p>
                      <h3>{product.name}</h3>
                      <span>
                        {product.rating ? `评分 ${product.rating}` : "评分未返回"}
                        {product.reviewCount ? ` / ${product.reviewCount} 评论` : ""}
                        {product.sellerName ? ` / ${product.sellerName}` : ""}
                      </span>
                      {scores && (
                        <div className="research-scores">
                          <div className="research-score" title="热度">
                            <span>热度</span>
                            <i style={{ width: `${scores.heat}%` }} />
                            <em>{scores.heat}</em>
                          </div>
                          <div className="research-score" title="利润">
                            <span>利润</span>
                            <i style={{ width: `${scores.profit}%` }} />
                            <em>{scores.profit}</em>
                          </div>
                          <div className="research-score" title="竞争（高=竞争激烈）">
                            <span>竞争</span>
                            <i style={{ width: `${scores.competition}%` }} />
                            <em>{scores.competition}</em>
                          </div>
                          <div className="research-score recommend" title="推荐指数">
                            <span>推荐</span>
                            <i style={{ width: `${scores.recommend}%` }} />
                            <em>{scores.recommend}</em>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="research-product-foot">
                      <div>
                        <strong>{product.price}</strong>
                        <small>{product.currency}</small>
                      </div>
                      <OzonMarketPoolButton product={product} researchKeyword={keyword} />
                    </div>
                  </article>
                  );
                })}
              </div>
              )}

              {marketProducts.length > 0 && filteredMarketProducts.length === 0 && (
                <section className="research-empty-market">
                  <h3>没有匹配筛选条件的商品</h3>
                  <p>请调整价格区间或排序方式。</p>
                </section>
              )}

              {marketProducts.length === 0 && (
                <section className="research-empty-market">
                  <h3>{marketResult.mode === "error" ? "当前账号未配置 Ozon Market / Apify 数据源，无法进行真实市场调研。" : "没有找到相关商品。"}</h3>
                  <p>{marketResult.mode === "error" ? "请先在店铺中心或 API 接入中心配置市场数据源。" : "没有找到相关商品，建议更换关键词或使用俄文关键词。"}</p>
                  <div>
                    <span>可接入来源</span>
                    <span>Ozon 前台采集服务</span>
                    <span>第三方榜单 API</span>
                    <span>自建搜索/爬虫服务</span>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {mode === "seller" && stores.length > 0 && (
        <>
          <form className="research-filter-bar">
            <input type="hidden" name="mode" value="seller" />
            <label className="block">
              <span>店铺</span>
              <select className="field" name="storeId" defaultValue={selectedStoreId}>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} / {store.ozonStoreId}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span>关键词 / 货号</span>
              <input className="field" name="keyword" defaultValue={keyword} placeholder="hair / 生发 / волос / offer id" />
            </label>
            <label className="block">
              <span>类目</span>
              <select className="field" name="category" defaultValue={category}>
                {ozonMarketCategories.map((item) => (
                  <option key={item.id || "all"} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span>最低价</span>
              <input className="field" name="minPrice" type="number" min="0" step="0.01" defaultValue={minPrice} />
            </label>
            <label className="block">
              <span>最高价</span>
              <input className="field" name="maxPrice" type="number" min="0" step="0.01" defaultValue={maxPrice} />
            </label>
            <label className="block">
              <span>图片</span>
              <select className="field" name="imageOnly" defaultValue={String(imageOnly)}>
                <option value="true">只看有图</option>
                <option value="false">全部商品</option>
              </select>
            </label>
            <label className="block">
              <span>排序</span>
              <select className="field" name="sort" defaultValue={sort}>
                <option value="default">有图优先</option>
                <option value="price">价格升序</option>
              </select>
            </label>
            <button className="btn-primary">刷新</button>
          </form>

          <div className="research-result-bar">
            <p>
              当前店铺：{selectedStore ? `${selectedStore.name} / ${selectedStore.ozonStoreId}` : "未选择"}。关键词会同时匹配中/英/俄常用词，例如 hair 会匹配 волос / 生发；图片仍只使用 Ozon API 返回的真实链接。
            </p>
            <span>{visibleProducts.length} items</span>
          </div>

          <section className="mt-4 border border-line bg-rail/60 p-4 text-sm leading-6 text-steel">
            <strong className="text-ink">市场热销榜说明：</strong>
            Ozon Seller API 不能直接返回 Ozon 前台搜索排名、热销 Top10-20 和平台类目榜。要做你要的“真实 Ozon 市场调研”，下一步需要接入独立数据源：Ozon 前台采集服务、第三方榜单 API，或你提供可用的 Ozon 类目/搜索数据接口。
          </section>

          <div className="research-product-grid">
            {visibleProducts.map((product) => (
              <article key={`${product.productId}_${product.offerId}`} className="research-product-card">
                <div className="research-product-media">
                  <ReliableProductImage
                    images={product.images}
                    alt={product.name}
                    className="h-full w-full object-contain"
                    emptyLabel="Ozon 未返回图片"
                  />
                  <span>{product.images.length ? `${product.images.length} 图` : "无图"}</span>
                </div>
                <div className="research-product-body">
                  <p>Offer: {product.offerId || "未返回"}</p>
                  <h3>{product.name}</h3>
                  <span>Product: {product.productId || "未返回"} / {product.archived ? "已归档" : "在售或可见"}</span>
                </div>
                <div className="research-product-foot">
                  <div>
                    <strong>{product.price}</strong>
                    <small>{product.currency}</small>
                  </div>
                  <OzonPoolButton productId={String(product.productId)} storeId={selectedStoreId || ""} productName={product.name} />
                </div>
              </article>
            ))}
          </div>

          {visibleProducts.length === 0 && !error && (
            <section className="mt-5 border border-line bg-rail p-5 text-sm leading-6 text-steel">
              当前筛选条件下没有商品。可以先关闭“只看有图”，或到店铺页点击 Ozon 商品同步确认 API 是否返回商品。
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
