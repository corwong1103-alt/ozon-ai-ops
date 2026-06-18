import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { productStatusLabel } from "@/lib/product-lifecycle";
import { FileText, Edit3, Eye, Trash2, Send } from "lucide-react";

function formatTime(d: Date) {
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DraftsPage() {
  const user = await requireApprovedUser();
  const drafts = await prisma.product.findMany({
    where: {
      userId: user.id,
      status: { in: ["optimized", "ready_to_publish"] }
    },
    orderBy: { updatedAt: "desc" },
    include: { store: { select: { name: true } } }
  });

  return (
    <AppShell title="草稿箱" eyebrow="已处理完成，待发布的商品" user={user}>
      {drafts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-steel">
          <FileText size={40} className="mb-3 text-steel/40" />
          <p className="text-sm">暂无草稿</p>
          <p className="mt-1 text-xs text-steel/60">在商品工厂完成 AI 处理后保存，商品会出现在这里</p>
          <Link href="/factory" className="mt-4 text-sm font-medium text-accent hover:underline">去商品工厂 →</Link>
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((draft) => {
          const images = imageList(draft.images);
          return (
            <div key={draft.id} className="flex items-center gap-4 rounded-xl border border-clay bg-white p-4 transition-all hover:border-accent/20 hover:shadow-sm">
              <ReliableProductImage images={images} alt={draft.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" emptyLabel="无图" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-earth">{draft.title}</h3>
                  <span className="shrink-0 rounded-full bg-rail px-1.5 py-0.5 text-[10px] font-medium text-steel">{productStatusLabel(draft.status)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-steel">
                  <span>最后编辑：{formatTime(draft.updatedAt)}</span>
                  <span>店铺：{draft.store?.name || "未绑定"}</span>
                  <span>¥{Number(draft.price).toFixed(0)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link href={`/factory/${draft.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  <Edit3 size={12} /> 继续编辑
                </Link>
                <Link href={`/products/${draft.id}`} className="btn-secondary text-xs flex items-center gap-1">
                  <Eye size={12} /> 预览
                </Link>
                <button className="btn-primary text-xs flex items-center gap-1">
                  <Send size={12} /> 发布
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
