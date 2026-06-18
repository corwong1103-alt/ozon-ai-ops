import Link from "next/link";
import { Boxes, ImageIcon, PackageSearch, Rocket } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { getDashboardTodoCounts, productStatusLabel, type ProductStatus, type ProductStatusCounts } from "@/lib/product-lifecycle";
import { getProductNextAction, productSourceFilterLabel } from "@/lib/product-main-flow";

function ProductTaskList({
  title,
  empty,
  products
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
  }>;
}) {
  return (
    <section className="dashboard-panel tasks">
      <div className="dashboard-panel-title">
        <span>{title}</span>
        <Link href="/products">商品池</Link>
      </div>
      <div className="dashboard-task-list">
        {products.length === 0 && <p className="dashboard-empty">{empty}</p>}
        {products.map((product) => {
          const images = imageList(product.images);
          const action = getProductNextAction(product.status, product.id);
          return (
            <div key={product.id} className="dashboard-task-row">
              <ReliableProductImage images={images} alt={product.title} className="h-10 w-10 rounded-md object-cover" emptyLabel="无图" />
              <strong>{product.title.slice(0, 24)}</strong>
              <span>{productStatusLabel(product.status)}</span>
              <p>{productSourceFilterLabel(product.source)} · {Number(product.price).toFixed(2)} {product.currency}</p>
              <Link href={action.href} className="btn-primary px-3 py-1 text-xs">继续处理</Link>
            </div>
          );
        })}
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
    { label: "待处理商品", value: todoCounts.pending, href: "/products", icon: PackageSearch, hint: "已入池，待开始" },
    { label: "AI 优化中", value: todoCounts.optimizing, href: "/products", icon: ImageIcon, hint: "生成中或待查看" },
    { label: "待发布", value: todoCounts.readyToPublish, href: "/products", icon: Boxes, hint: "已优化/已确认" },
    { label: "已发布", value: publishedCount, href: "/content", icon: Rocket, hint: "可生成推广内容" }
  ];

  const pendingProducts = taskProducts.filter((product) => product.status === "discovered" || product.status === "in_product_center" || product.status === "favorited");
  const optimizingProducts = taskProducts.filter((product) => product.status === "optimizing");
  const readyProducts = taskProducts.filter((product) => product.status === "optimized" || product.status === "ready_to_publish");

  return (
    <AppShell title="卖家工作台" eyebrow="Task Board" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">任务看板</p>
            <h3>从市场调研到 Ozon 上架，只保留当前要处理的商品。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>{user.plan}</span>
            <span>{user.status}</span>
          </div>
        </div>

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

        <div className="dashboard-main-grid mt-5">
          <ProductTaskList title="待处理商品" empty="暂无待处理商品，先去市场调研加入商品池。" products={pendingProducts} />
          <ProductTaskList title="AI 优化中" empty="暂无 AI 优化中的商品。" products={optimizingProducts} />
          <ProductTaskList title="待发布商品" empty="暂无待发布商品，先完成人工确认。" products={readyProducts} />
        </div>
      </section>
    </AppShell>
  );
}
