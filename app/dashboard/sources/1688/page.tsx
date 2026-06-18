import { requireApprovedUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Source1688Console } from "@/components/Source1688Console";
import { prisma } from "@/lib/prisma";
import { getApifyRuntimeConfig } from "@/lib/apify/client";

export const dynamic = "force-dynamic";

/**
 * /dashboard/sources/1688
 * 1688 数据源采集页：搜索框 + 结果表 + 导入按钮。
 * 已导入的商品会标记，防止重复导入。
 */
export default async function Source1688Page({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireApprovedUser();

  // 检查 1688 Apify 配置状态
  const config = await getApifyRuntimeConfig(user.id, "source_1688");
  const configured = config.configured;

  // 已导入的 1688 sourceProduct（用于结果表标记）
  const importedSources = await prisma.sourceProduct.findMany({
    where: { source: "1688", importedBy: user.id },
    select: { sourceProductId: true, importedProductId: true }
  });
  const importedProducts = importedSources.map((s) => ({
    sourceProductId: s.sourceProductId,
    importedProductId: s.importedProductId
  }));

  return (
    <AppShell title="1688 采集" eyebrow="数据源 · 1688" user={user}>
      <Source1688Console
        configured={configured}
        tokenSource={config.tokenSource}
        importedProducts={importedProducts}
      />
    </AppShell>
  );
}
