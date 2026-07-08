import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SellerProductCard } from "@/components/SellerProductCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELLER_WORKFLOW_STEPS } from "@/lib/product-lifecycle";

export default async function PublishedPage() {
  const user = await requireApprovedUser();
  const published = await prisma.product.findMany({
    where: {
      userId: user.id,
      status: { in: ["published", "promoted"] }
    },
    orderBy: { updatedAt: "desc" },
    include: { store: { select: { name: true, ozonStoreId: true } } }
  });

  return (
    <AppShell title="已发布" eyebrow="STEP 4 / 已发布商品" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Published</span>
            <h2>已经发布的商品</h2>
            <p>这里保留最终结果。复盘、推广和重新编辑都从商品详情进入，列表只展示关键状态。</p>
          </div>
          <Link href="/research" className="btn-primary">继续发现商品</Link>
        </div>

        <div className="seller-workflow">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.label} className={`seller-workflow-step ${index === 3 ? "is-active" : ""}`}>
              <span>STEP {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        {published.length === 0 && (
          <div className="seller-empty">
            <div>
              <h3>暂无已发布商品</h3>
              <p>商品确认并发布后，会在这里形成最终列表。</p>
              <Link href="/factory/drafts" className="btn-primary mt-4">查看待发布</Link>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {published.map((product) => (
            <SellerProductCard key={product.id} product={product} hrefPrefix="/factory" actionLabel="查看商品" />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
