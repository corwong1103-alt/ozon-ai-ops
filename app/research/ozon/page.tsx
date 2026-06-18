import { OzonResearchConsole } from "@/components/OzonResearchConsole";
import { ResearchShell } from "@/components/ResearchShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveMarketSearchForPage } from "@/lib/services/research-task";
import { expandKeyword, type KeywordExpansionResult } from "@/lib/services/keyword-expander";
import { scoreProducts, type ScoredProduct } from "@/lib/services/product-scoring";
import { getOzonProductsForImport, type OzonProductImport } from "@/lib/services/ozon";
import type { OzonMarketUiProduct } from "@/lib/ozon-market-normalizer";

export default async function OzonResearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireApprovedUser();
  const mode = searchParams.mode === "seller" ? "seller" : "market";
  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, ozonStoreId: true, ozonClientId: true, apiKeyEncrypted: true }
  });
  const requestedStoreId = typeof searchParams.storeId === "string" ? searchParams.storeId : "";
  const selectedStore = stores.find((store) => store.id === requestedStoreId) || stores[0];
  let products: OzonProductImport[] = [];
  let error: string | undefined;
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword : "";
  const categoryId = typeof searchParams.category === "string" ? searchParams.category : "";

  let marketProducts: OzonMarketUiProduct[] = [];
  let marketMessage = "";
  let marketSourceName = "Apify Ozon Market";
  let marketMode: "configured" | "unconfigured" | "error" = "configured";
  let pendingTaskId: string | undefined;
  let keywordExpansion: KeywordExpansionResult | undefined;
  let scoredProducts: ScoredProduct[] = [];

  if (mode === "market" && keyword.trim()) {
    try { keywordExpansion = await expandKeyword({ userId: user.id, keyword, categoryId }); } catch { keywordExpansion = undefined; }
    const searchKeyword = keywordExpansion?.translatedRu || keyword;
    console.info("[market_search_keywords]", JSON.stringify({
      originalKeyword: keyword,
      expandedKeywords: keywordExpansion?.keywords.map((item) => item.keyword) || [keyword],
      marketSource: "Apify Ozon Market"
    }));

    const resolved = await resolveMarketSearchForPage({ userId: user.id, keyword: searchKeyword, categoryId });
    if (resolved.mode === "cache_hit") { marketProducts = resolved.products; marketMessage = resolved.message; scoredProducts = scoreProducts(marketProducts); }
    else if (resolved.mode === "task_pending") { pendingTaskId = resolved.taskId; marketMessage = resolved.message; }
    else if (resolved.mode === "market_error") { marketMode = "error"; marketMessage = `${resolved.code}: ${resolved.message}`; }
    else { marketMode = "unconfigured"; marketMessage = resolved.message; }
  } else if (mode === "market" && categoryId) {
    const resolved = await resolveMarketSearchForPage({ userId: user.id, keyword: "", categoryId });
    if (resolved.mode === "cache_hit") { marketProducts = resolved.products; marketMessage = resolved.message; scoredProducts = scoreProducts(marketProducts); }
    else if (resolved.mode === "task_pending") { pendingTaskId = resolved.taskId; marketMessage = resolved.message; }
    else { marketMode = "unconfigured"; marketMessage = resolved.message; }
  } else if (mode === "market") {
    marketMode = "unconfigured";
    marketMessage = "请输入关键词或选择类目，AI 会自动翻译并扩展俄语搜索词。";
  } else {
    marketMessage = "当前正在查看店铺 Seller API 商品。";
  }

  if (selectedStore && mode === "seller") {
    try { products = await getOzonProductsForImport(selectedStore, 50); }
    catch (caught) { error = caught instanceof Error ? caught.message : "Unknown Ozon API error."; }
  }

  return (
    <ResearchShell user={{ email: user.email, role: user.role, status: user.status, plan: user.plan }}>
      <OzonResearchConsole
        user={user}
        stores={stores.map((store) => ({ id: store.id, name: store.name, ozonStoreId: store.ozonStoreId }))}
        selectedStoreId={selectedStore?.id}
        products={products}
        marketResult={{ mode: marketMode, sourceName: marketSourceName, message: marketMessage, products: marketProducts }}
        keywordExpansion={keywordExpansion}
        scoredProducts={scoredProducts}
        pendingTaskId={pendingTaskId}
        pendingKeyword={keyword}
        mode={mode}
        error={error}
        searchParams={searchParams}
      />
    </ResearchShell>
  );
}
