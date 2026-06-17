import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { AiGeneratedImagePanel } from "@/components/AiGeneratedImagePanel";
import { ProductAiButtons, ProductEditForm, ProductUploadForm } from "@/components/ProductActionControls";
import { ProductImageManager } from "@/components/ProductImageManager";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";

function imagesToText(images: unknown) {
  return imageList(images).join("\n");
}

function collectGeneratedImageUrls(value: Prisma.JsonValue | null | undefined, target: string[] = []) {
  if (!value) return target;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(value)) target.push(value);
    return target;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectGeneratedImageUrls(item, target));
    return target;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectGeneratedImageUrls(item, target));
  }
  return target;
}

function readInferredPrompt(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const prompt = value.inferredPrompt;
  return typeof prompt === "string" ? prompt : "";
}

export default async function ProductEditPage({ params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const [product, stores, tasks] = await Promise.all([
    prisma.product.findFirst({ where: { id: params.id, userId: user.id } }),
    prisma.store.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.taskLog.findMany({ where: { userId: user.id, productId: params.id }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  if (!product) notFound();
  const images = imageList(product.images);
  const generatedImages = tasks
    .filter((task) => task.type === "image")
    .flatMap((task) => collectGeneratedImageUrls(task.metadata).map((url) => ({
      url,
      status: task.status,
      createdAt: task.createdAt.toISOString()
    })))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  const latestInferredPrompt = tasks.map((task) => readInferredPrompt(task.metadata)).find(Boolean) || "";

  return (
    <AppShell title="商品上架工单" eyebrow="图片与上架" user={user}>
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="ledger-card p-5">
          <ProductEditForm
            productId={product.id}
            title={product.title}
            description={product.description}
            price={Number(product.price)}
            imagesText={imagesToText(product.images)}
          />
          <ProductAiButtons productId={product.id} />
        </section>

        <aside className="space-y-5">
          <AiGeneratedImagePanel productId={product.id} productImages={images} images={generatedImages} initialPrompt={latestInferredPrompt} />

          <section className="ledger-card overflow-hidden product-image-dock">
            <div className="relative border-b border-line px-5 py-4">
              <p className="text-xs font-bold text-accent">图片工作台</p>
              <h3 className="mt-1 font-display text-2xl">直接拖动、替换、删除</h3>
              <p className="mt-2 text-sm leading-6 text-steel">拖动图片即可排序，第一张作为商品池和社媒主图。</p>
            </div>
            <ProductImageManager productId={product.id} title={product.title} images={images} />
          </section>

          <section className="ledger-card p-5">
            <h3 className="relative font-display text-3xl">上传到 Ozon</h3>
            <p className="relative mt-2 text-sm leading-6 text-steel">上传前必须选择一个属于当前用户的 Ozon 店铺。当前保留为模拟上传，不会改动真实 Ozon 商品。</p>
            <ProductUploadForm productId={product.id} stores={stores} defaultStoreId={product.storeId ?? ""} />
          </section>

          <section className="ledger-card p-5">
            <h3 className="font-display text-3xl">测试说明</h3>
            <div className="mt-3 space-y-2 text-sm leading-6 text-steel">
              <p>翻译和客服建议：配置百炼 `DASHSCOPE_API_KEY` 后会调用 Qwen；未配置时走 mock。</p>
              <p>AI商品图 / AI视频：最后一步再测，需要百炼图片/视频模型可用，并消耗本地额度。</p>
              <p>真实上架/改库存：当前未打开写入 Ozon 的动作，避免测试阶段误改线上商品。</p>
            </div>
          </section>

          <section className="ledger-card p-5">
            <h3 className="font-display text-3xl">任务状态</h3>
            <div className="mt-4 divide-y divide-line">
              {tasks.length === 0 && <p className="text-sm text-steel">暂无任务。</p>}
              {tasks.map((task) => (
                <div key={task.id} className="py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <strong>{task.type}</strong>
                    <span className="status-chip">{task.status}</span>
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
