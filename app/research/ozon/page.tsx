import { MockSearchPage } from "@/components/MockSearchPage";
import { requireApprovedUser } from "@/lib/auth";

export default async function OzonResearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireApprovedUser();

  return (
    <MockSearchPage
      user={user}
      source="ozon"
      title="Ozon 调研"
      eyebrow="Product Research"
      description="使用本地 mock service 模拟 Ozon 商品调研，可筛选关键词、周/月热销、价格区间和销量排序，并加入商品池。"
      searchParams={searchParams}
    />
  );
}
