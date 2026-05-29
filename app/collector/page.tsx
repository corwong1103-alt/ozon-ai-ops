import { MockSearchPage } from "@/components/MockSearchPage";
import { requireApprovedUser } from "@/lib/auth";

export default async function CollectorPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireApprovedUser();

  return (
    <MockSearchPage
      user={user}
      source="source_1688"
      title="1688 采集"
      eyebrow="1688 Collector"
      description="使用本地 mock service 模拟 1688 商品采集，可筛选关键词、周/月热销、价格区间和销量排序，并加入商品池。"
      searchParams={searchParams}
    />
  );
}
