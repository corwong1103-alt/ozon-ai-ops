import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProduct } from "./actions";

export default async function ProductsPage() {
  const user = await requireApprovedUser();
  const products = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <AppShell title="商品池" eyebrow="Product Workspace" user={user}>
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <form action={createProduct} className="ledger-card p-5">
          <h3 className="font-display text-3xl">新增商品</h3>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">来源</span>
              <select className="field" name="source" defaultValue="manual">
                <option value="manual">manual</option>
                <option value="ozon">ozon</option>
                <option value="source_1688">1688</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品标题</span>
              <input className="field" name="title" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品描述</span>
              <textarea className="field min-h-28" name="description" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">价格</span>
              <input className="field" name="price" type="number" min="0" step="0.01" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">图片 URL，每行一个</span>
              <textarea className="field min-h-24" name="images" />
            </label>
          </div>
          <button className="btn-primary mt-5 w-full">保存到商品池</button>
        </form>

        <section className="ledger-card overflow-hidden">
          <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-steel">
            <span className="col-span-5">商品</span>
            <span className="col-span-2">来源</span>
            <span className="col-span-2">状态</span>
            <span className="col-span-3 text-right">操作</span>
          </div>
          {products.length === 0 && <p className="p-5 text-sm text-steel">暂无商品，先从左侧添加一个手动商品。</p>}
          {products.map((product) => (
            <div key={product.id} className="grid grid-cols-12 items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
              <div className="col-span-12 md:col-span-5">
                <h3 className="font-display text-2xl">{product.title}</h3>
                <p className="mt-1 text-xs text-steel">¥{Number(product.price).toFixed(2)}</p>
              </div>
              <span className="col-span-4 text-sm text-steel md:col-span-2">{product.source}</span>
              <span className="col-span-4 text-sm text-steel md:col-span-2">{product.status}</span>
              <Link href={`/products/${product.id}`} className="col-span-4 text-right text-sm font-bold text-accent md:col-span-3">
                编辑
              </Link>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
