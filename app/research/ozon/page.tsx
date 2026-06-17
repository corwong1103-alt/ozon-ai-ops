import { OzonResearchConsole } from "@/components/OzonResearchConsole";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchOzonMarketProducts } from "@/lib/services/ozon-market";
import { getOzonProductsForImport, type OzonProductImport } from "@/lib/services/ozon";

export default async function OzonResearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireApprovedUser();
  const mode = searchParams.mode === "seller" ? "seller" : "market";
  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      ozonStoreId: true,
      ozonClientId: true,
      apiKeyEncrypted: true
    }
  });
  const requestedStoreId = typeof searchParams.storeId === "string" ? searchParams.storeId : "";
  const selectedStore = stores.find((store) => store.id === requestedStoreId) || stores[0];
  let products: OzonProductImport[] = [];
  let error: string | undefined;
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword : "";
  const categoryId = typeof searchParams.category === "string" ? searchParams.category : "";
  const marketResult = mode === "market"
    ? await searchOzonMarketProducts({ userId: user.id, keyword, categoryId, limit: 20 })
    : {
        mode: "unconfigured" as const,
        sourceName: "Ozon 市场数据源",
        message: "当前正在查看店铺 Seller API 商品。",
        products: []
      };

  if (selectedStore && mode === "seller") {
    try {
      products = await getOzonProductsForImport(selectedStore, 50);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unknown Ozon API error.";
    }
  }

  return (
    <OzonResearchConsole
      user={user}
      stores={stores.map((store) => ({ id: store.id, name: store.name, ozonStoreId: store.ozonStoreId }))}
      selectedStoreId={selectedStore?.id}
      products={products}
      marketResult={marketResult}
      mode={mode}
      error={error}
      searchParams={searchParams}
    />
  );
}
