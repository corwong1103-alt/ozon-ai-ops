import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SellerProductCard } from "@/components/SellerProductCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELLER_WORKFLOW_STEPS } from "@/lib/product-lifecycle";

export default async function DraftsPage() {
  const user = await requireApprovedUser();
  const readyProducts = await prisma.product.findMany({
    where: {
      userId: user.id,
      status: { in: ["optimized", "ready_to_publish"] }
    },
    orderBy: { updatedAt: "desc" },
    include: { store: { select: { name: true } } }
  });

  return (
    <AppShell title="待发布" eyebrow="STEP 3-4 / 确认并发布商品" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Publish Queue</span>
            <h2>最后检查，然后发布</h2>
            <p>这里仅保留已经制作完成、等待人工确认或发布的商品。确认无误后选择店铺并发布到 Ozon。</p>
          </div>
          <Link href="/factory" className="btn-secondary">返回商品制作</Link>
        </div>

        <div className="seller-workflow">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.label} className={`seller-workflow-step ${index >= 2 ? "is-active" : ""}`}>
              <span>STEP {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        {readyProducts.length === 0 && (
          <div className="seller-empty">
            <div>
              <h3>暂无待发布商品</h3>
              <p>商品完成 AI Workspace 制作并人工确认后，会进入这里。</p>
              <Link href="/factory" className="btn-primary mt-4">去制作商品</Link>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {readyProducts.map((product) => (
            <SellerProductCard
              key={product.id}
              product={product}
              hrefPrefix="/factory"
              actionLabel={product.status === "ready_to_publish" ? "立即发布" : "确认商品"}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
