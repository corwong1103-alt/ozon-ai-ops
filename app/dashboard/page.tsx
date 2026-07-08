import Link from "next/link";
import { CheckCircle2, Clock3, PackageSearch, Rocket, Sparkles, Store } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SellerProductCard } from "@/components/SellerProductCard";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SELLER_WORKFLOW_STEPS, getDashboardTodoCounts, type ProductStatus, type ProductStatusCounts } from "@/lib/product-lifecycle";

function ProductTaskList({
  title,
  empty,
  products,
  hrefPrefix = "/products"
}: {
  title: string;
  empty: string;
  products: Array<{
    id: string;
    title: string;
    source: string;
    status: string;
    images: unknown;
    price: unknown;
    currency: string;
    updatedAt: Date;
  }>;
  hrefPrefix?: "/products" | "/factory";
}) {
  return (
    <section className="dashboard-panel tasks">
      <div className="dashboard-panel-title">
        <span>{title}</span>
        <Link href={hrefPrefix === "/factory" ? "/factory" : "/products"}>查看全部</Link>
      </div>
      <div className="dashboard-task-list">
        {products.length === 0 && <p className="dashboard-empty">{empty}</p>}
        {products.map((product) => (
          <SellerProductCard key={product.id} product={product} hrefPrefix={hrefPrefix} />
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireApprovedUser();
  const [productCounts, taskProducts] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    prisma.product.findMany({
      where: {
        userId: user.id,
        status: { in: ["discovered", "in_product_center", "optimizing", "optimized", "ready_to_publish"] }
      },
      orderBy: { updatedAt: "desc" },
      take: 18
    })
  ]);

  const lifecycleCounts = productCounts.reduce<ProductStatusCounts>((acc, item) => {
    acc[item.status as ProductStatus] = item._count._all;
    return acc;
  }, {});
  const todoCounts = getDashboardTodoCounts(lifecycleCounts);
  const publishedCount = productCounts.find((c) => c.status === "published")?._count._all ?? 0;
  const todoCards = [
    { label: "待筛选", value: todoCounts.pending, href: "/research", icon: PackageSearch, hint: "先挑出值得制作的商品" },
    { label: "制作中", value: todoCounts.optimizing, href: "/factory", icon: Sparkles, hint: "继续整理标题、描述和图片" },
    { label: "待发布", value: todoCounts.readyToPublish, href: "/factory/drafts", icon: Rocket, hint: "确认后即可发布" },
    { label: "已发布", value: publishedCount, href: "/published", icon: CheckCircle2, hint: "查看已上架商品" }
  ];

  const pendingProducts = taskProducts.filter((product) => product.status === "discovered" || product.status === "in_product_center" || product.status === "favorited");
  const optimizingProducts = taskProducts.filter((product) => product.status === "optimizing");
  const readyProducts = taskProducts.filter((product) => product.status === "optimized" || product.status === "ready_to_publish");

  return (
    <AppShell title="首页" eyebrow="今天该做什么" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Seller Workflow</span>
            <h2>今天只推进下一步</h2>
            <p>从发现商品到发布商品，首页只显示需要你处理的任务。其它系统数据已折叠到对应页面。</p>
          </div>
          <Link href="/research" className="btn-primary">发现商品</Link>
        </div>

        <div className="seller-workflow">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.label} className={`seller-workflow-step ${index === 0 ? "is-active" : ""}`}>
              <span>STEP {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="dashboard-kpi-grid">
            {todoCards.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="dashboard-kpi-card">
                  <div className="dashboard-kpi-head">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  <div className="dashboard-kpi-value">
                    <strong>{item.value}</strong>
                    <span>件</span>
                  </div>
                  <p>{item.hint}</p>
                </Link>
              );
            })}
          </div>

          <aside className="ledger-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-earth">
              <Store size={16} />
              店铺状态
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-steel">账户</span>
                <strong>{user.plan}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-steel">授权</span>
                <strong>{user.status}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-steel">最近任务</span>
                <strong className="inline-flex items-center gap-1"><Clock3 size={13} /> {taskProducts.length}</strong>
              </div>
            </div>
          </aside>
        </div>

        <div className="dashboard-main-grid mt-5">
          <ProductTaskList title="待处理商品" empty="暂无待处理商品，先去发现商品。" products={pendingProducts} />
          <ProductTaskList title="制作中" empty="暂无制作中的商品。" products={optimizingProducts} hrefPrefix="/factory" />
          <ProductTaskList title="待发布" empty="暂无待发布商品，先完成人工确认。" products={readyProducts} hrefPrefix="/factory" />
        </div>
      </section>
    </AppShell>
  );
}
