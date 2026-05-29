import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateProductImage,
  generateProductVideo,
  translateImageText,
  translateProduct,
  updateProduct,
  uploadProduct
} from "../actions";

function imagesToText(images: unknown) {
  return Array.isArray(images) ? images.join("\n") : "";
}

export default async function ProductEditPage({ params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const [product, stores, tasks] = await Promise.all([
    prisma.product.findFirst({ where: { id: params.id, userId: user.id } }),
    prisma.store.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.taskLog.findMany({ where: { userId: user.id, productId: params.id }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  if (!product) notFound();

  return (
    <AppShell title="商品编辑" eyebrow="Product Workspace" user={user}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="ledger-card p-5">
          <form action={updateProduct.bind(null, product.id)} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品标题</span>
              <input className="field" name="title" defaultValue={product.title} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品描述</span>
              <textarea className="field min-h-36" name="description" defaultValue={product.description} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品价格</span>
              <input className="field" name="price" type="number" min="0" step="0.01" defaultValue={Number(product.price)} required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品图片</span>
              <textarea className="field min-h-28" name="images" defaultValue={imagesToText(product.images)} />
            </label>
            <button className="btn-primary">保存商品</button>
          </form>

          <div className="mt-6 grid gap-3 border-t border-line pt-5 md:grid-cols-2">
            <form action={translateProduct.bind(null, product.id)}>
              <button className="btn-secondary w-full">标题/描述翻译俄文</button>
            </form>
            <form action={translateImageText.bind(null, product.id)}>
              <button className="btn-secondary w-full">图片文字翻译俄文</button>
            </form>
            <form action={generateProductImage.bind(null, product.id)}>
              <button className="btn-primary w-full">AI商品图生成</button>
            </form>
            <form action={generateProductVideo.bind(null, product.id)}>
              <button className="btn-primary w-full">AI视频生成</button>
            </form>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="ledger-card p-5">
            <h3 className="font-display text-3xl">上传到 Ozon</h3>
            <p className="mt-2 text-sm leading-6 text-steel">上传前必须选择一个属于当前用户的 Ozon 店铺。当前使用 mock adapter，不接真实 Ozon API。</p>
            <form action={uploadProduct.bind(null, product.id)} className="mt-4 space-y-4">
              <select className="field" name="storeId" required defaultValue={product.storeId ?? ""}>
                <option value="">选择店铺</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} / {store.ozonStoreId}
                  </option>
                ))}
              </select>
              <button className="btn-primary w-full">上传到 Ozon</button>
            </form>
          </section>

          <section className="ledger-card p-5">
            <h3 className="font-display text-3xl">任务状态</h3>
            <div className="mt-4 divide-y divide-line">
              {tasks.length === 0 && <p className="text-sm text-steel">暂无任务。</p>}
              {tasks.map((task) => (
                <div key={task.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <strong>{task.type}</strong>
                    <span className="text-steel">{task.status}</span>
                  </div>
                  <p className="mt-1 text-steel">{task.message}</p>
                  <p className="mt-1 text-xs text-steel">额度消耗：{task.creditCost}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
