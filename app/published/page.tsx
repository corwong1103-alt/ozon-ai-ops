import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { CheckCircle2, Eye, ExternalLink } from "lucide-react";

function formatTime(d: Date) {
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    <AppShell title="已发布商品" eyebrow="已上架到 Ozon 的商品" user={user}>
      {published.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-steel">
          <CheckCircle2 size={40} className="mb-3 text-steel/40" />
          <p className="text-sm">暂无已发布商品</p>
          <p className="mt-1 text-xs text-steel/60">在商品工厂完成 AI 处理并在草稿箱点击发布后，商品会出现在这里</p>
          <Link href="/factory" className="mt-4 text-sm font-medium text-accent hover:underline">去商品工厂 →</Link>
        </div>
      )}

      <div className="space-y-3">
        {published.map((product) => {
          const images = imageList(product.images);
          return (
            <div key={product.id} className="flex items-center gap-4 rounded-xl border border-clay bg-white p-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-green-50">
                <CheckCircle2 size={24} className="text-green-500" />
              </div>
              {images.length > 0 && (
                <ReliableProductImage images={images} alt={product.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" emptyLabel="" />
              )}

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-earth">{product.title}</h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-steel">
                  <span>店铺：{product.store?.name || "未知"}</span>
                  <span>发布：{formatTime(product.updatedAt)}</span>
                  <span>¥{Number(product.price).toFixed(0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link href={`/products/${product.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  <Eye size={12} /> 查看详情
                </Link>
                {product.store?.ozonStoreId && (
                  <a href={`https://www.ozon.ru/product/${product.sourceProductId || product.offerId}/`} target="_blank" rel="noopener" className="btn-secondary text-xs flex items-center gap-1">
                    <ExternalLink size={12} /> Ozon
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
