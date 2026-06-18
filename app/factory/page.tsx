import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { productStatusLabel } from "@/lib/product-lifecycle";
import { Factory, ArrowRight, PenLine, Sparkles, FileText, CheckCircle2, Search } from "lucide-react";

export default async function FactoryPage() {
  const user = await requireApprovedUser();
  const products = await prisma.product.findMany({
    where: {
      userId: user.id,
      status: { in: ["discovered", "in_product_center", "optimizing", "optimized", "ready_to_publish"] }
    },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  const workbenchProducts = products.filter((p) =>
    ["in_product_center", "optimizing"].includes(p.status)
  );
  const draftProducts = products.filter((p) =>
    ["optimized", "ready_to_publish"].includes(p.status)
  );
  const rawProducts = products.filter((p) =>
    ["discovered"].includes(p.status)
  );

  return (
    <AppShell title="商品工厂" eyebrow="选品 → AI 处理 → 发布" user={user}>
      {/* Guide Banner */}
      <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-white">
            <Factory size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-earth">商品工厂</h2>
            <p className="mt-1 text-sm text-steel">
              这里是你的商品加工流水线。左侧是原始数据，右侧是 AI 工作台。处理完成后保存草稿，确认无误后发布。
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-steel">
              <span className="inline-flex items-center gap-1 rounded-full bg-rail px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                待处理 {workbenchProducts.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rail px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                草稿 {draftProducts.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rail px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-steel/40" />
                待入库 {rawProducts.length}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/research" className="btn-secondary text-xs">选品中心 →</Link>
            {draftProducts.length > 0 && (
              <Link href="/factory/drafts" className="btn-primary text-xs">查看草稿 ({draftProducts.length})</Link>
            )}
          </div>
        </div>
      </div>

      {/* Raw products (discovered — need to enter pool first) */}
      {rawProducts.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-earth">
            <PenLine size={16} className="text-steel" />
            待入库 ({rawProducts.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rawProducts.slice(0, 6).map((p) => {
              const images = imageList(p.images);
              return (
                <Link key={p.id} href={`/factory/${p.id}`} className="group flex items-center gap-3 rounded-lg border border-clay bg-white p-3 transition-all hover:border-accent/30 hover:shadow-sm">
                  <ReliableProductImage images={images} alt={p.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" emptyLabel="无图" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-earth">{p.title}</p>
                    <p className="mt-0.5 text-xs text-steel">{productStatusLabel(p.status)} · ¥{Number(p.price).toFixed(0)}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-steel/40 group-hover:text-accent" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Workbench products */}
      <section className="mb-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-earth">
          <Sparkles size={16} className="text-accent" />
          AI 处理中 ({workbenchProducts.length})
        </h3>
        {workbenchProducts.length === 0 && (
          <div className="rounded-lg border border-dashed border-clay p-8 text-center">
            <Factory size={24} className="mx-auto mb-2 text-steel/40" />
            <p className="text-sm text-steel">暂无处理中的商品</p>
            <p className="mt-1 text-xs text-steel/60">从选品中心导入商品后，这里会出现 AI 工作台</p>
            <Link href="/research" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">去选品中心 →</Link>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workbenchProducts.map((p) => {
            const images = imageList(p.images);
            return (
              <Link key={p.id} href={`/factory/${p.id}`} className="group flex items-center gap-3 rounded-lg border border-clay bg-white p-3 transition-all hover:border-accent/30 hover:shadow-sm">
                <ReliableProductImage images={images} alt={p.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" emptyLabel="无图" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-earth">{p.title}</p>
                  <p className="mt-0.5 text-xs text-steel">{productStatusLabel(p.status)} · ¥{Number(p.price).toFixed(0)}</p>
                </div>
                <ArrowRight size={14} className="shrink-0 text-steel/40 group-hover:text-accent" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link href="/factory/drafts" className="rounded-xl border border-clay bg-white p-4 hover:border-accent/30 transition-all">
          <FileText size={20} className="mb-2 text-amber-500" />
          <h3 className="text-sm font-semibold text-earth">草稿箱</h3>
          <p className="mt-1 text-xs text-steel">{draftProducts.length} 件待发布</p>
        </Link>
        <Link href="/published" className="rounded-xl border border-clay bg-white p-4 hover:border-accent/30 transition-all">
          <CheckCircle2 size={20} className="mb-2 text-green-500" />
          <h3 className="text-sm font-semibold text-earth">已发布</h3>
          <p className="mt-1 text-xs text-steel">查看已上架商品</p>
        </Link>
        <Link href="/research" className="rounded-xl border border-clay bg-white p-4 hover:border-accent/30 transition-all">
          <Search size={20} className="mb-2 text-accent" />
          <h3 className="text-sm font-semibold text-earth">选品中心</h3>
          <p className="mt-1 text-xs text-steel">发现新商品</p>
        </Link>
      </div>
    </AppShell>
  );
}
