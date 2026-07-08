import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SellerProductCard } from "@/components/SellerProductCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELLER_WORKFLOW_STEPS } from "@/lib/product-lifecycle";

export default async function FactoryPage() {
  const user = await requireApprovedUser();
  const products = await prisma.product.findMany({
    where: {
      userId: user.id,
      status: { in: ["in_product_center", "optimizing", "optimized"] }
    },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  const makingProducts = products.filter((p) => ["in_product_center", "optimizing"].includes(p.status));
  const confirmProducts = products.filter((p) => p.status === "optimized");

  return (
    <AppShell title="商品制作" eyebrow="STEP 2 / 制作商品" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">AI Workspace</span>
            <h2>把原始商品做成可发布商品</h2>
            <p>这里集中处理标题、描述、翻译、图片、属性和价格建议。每个商品只保留一个下一步，避免在多个 AI 页面之间切换。</p>
          </div>
          <Link href="/research" className="btn-secondary">继续发现商品</Link>
        </div>

        <div className="seller-workflow">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.label} className={`seller-workflow-step ${index === 1 ? "is-active" : ""}`}>
              <span>STEP {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="ledger-card p-4">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-earth">制作中</h3>
                <p className="mt-1 text-sm text-steel">继续补齐商品资料，或让 AI Workspace 一键生成。</p>
              </div>
              <span className="status-chip">{makingProducts.length} 件</span>
            </div>
            <div className="grid gap-3">
              {makingProducts.length === 0 && (
                <div className="seller-empty">
                  <div>
                    <h3>暂无制作中的商品</h3>
                    <p>先从发现商品加入一个真实来源商品，再回到这里制作。</p>
                    <Link href="/research" className="btn-primary mt-4">发现商品</Link>
                  </div>
                </div>
              )}
              {makingProducts.map((product) => (
                <SellerProductCard key={product.id} product={product} hrefPrefix="/factory" />
              ))}
            </div>
          </div>

          <div className="ledger-card p-4">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-earth">待确认</h3>
                <p className="mt-1 text-sm text-steel">AI 已生成资料，需要人工检查后进入待发布。</p>
              </div>
              <span className="status-chip">{confirmProducts.length} 件</span>
            </div>
            <div className="grid gap-3">
              {confirmProducts.length === 0 && <p className="dashboard-empty">暂无待确认商品。</p>}
              {confirmProducts.map((product) => (
                <SellerProductCard key={product.id} product={product} hrefPrefix="/factory" actionLabel="确认商品" />
              ))}
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
