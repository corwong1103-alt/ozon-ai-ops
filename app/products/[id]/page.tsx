import { notFound } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { AiGeneratedImagePanel } from "@/components/AiGeneratedImagePanel";
import { ProductAiButtons, ProductEditForm, ProductUploadForm } from "@/components/ProductActionControls";
import { ProductImageManager } from "@/components/ProductImageManager";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { buildUploadChecklist } from "@/lib/services/ozon";

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

const LIFECYCLE_STAGES: Array<{ key: string; label: string }> = [
  { key: "discovered", label: "发现" },
  { key: "favorited", label: "收藏" },
  { key: "optimizing", label: "优化中" },
  { key: "optimized", label: "已优化" },
  { key: "ready_to_publish", label: "待发布" },
  { key: "published", label: "已上架" },
  { key: "promoted", label: "已推广" }
];

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
      url, status: task.status, createdAt: task.createdAt.toISOString()
    })))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  const latestInferredPrompt = tasks.map((task) => readInferredPrompt(task.metadata)).find(Boolean) || "";

  const currentStageIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === product.status);

  return (
    <AppShell title={product.title} eyebrow="商品中心 · 详情" user={user}>
      {/* 生命周期进度条 */}
      <section className="ledger-card mb-5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-steel">商品生命周期</p>
          <span className="status-chip">{LIFECYCLE_STAGES[currentStageIndex]?.label || product.status}</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {LIFECYCLE_STAGES.map((stage, index) => {
            const done = index < currentStageIndex;
            const current = index === currentStageIndex;
            return (
              <div key={stage.key} className="flex items-center gap-1 whitespace-nowrap">
                <div className={`lifecycle-node ${done ? "done" : current ? "current" : ""}`}>
                  <span>{stage.label}</span>
                </div>
                {index < LIFECYCLE_STAGES.length - 1 && <div className={`lifecycle-bar ${done ? "done" : ""}`} />}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* 模块1: 原始数据 */}
        <section className="ledger-card p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 1 · 原始数据</p>
            <h3 className="mt-1 font-display text-2xl">商品基础信息</h3>
          </div>
          <ProductEditForm
            productId={product.id}
            title={product.title}
            description={product.description}
            price={Number(product.price)}
            imagesText={imagesToText(product.images)}
          />
        </section>

        {/* 模块2: 商品处理 */}
        <section className="ledger-card p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 2 · 商品处理</p>
            <h3 className="mt-1 font-display text-2xl">直接铺品 / AI 优化</h3>
          </div>
          <p className="mb-4 text-sm leading-6 text-steel">AI 不是必经步骤。可直接铺品上架，或先 AI 优化再发布。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3">
              <strong className="text-sm">流程 A · 直接铺品</strong>
              <p className="mt-1 text-xs text-steel">用原始数据直接发布到 Ozon</p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <strong className="text-sm">流程 B · AI 优化</strong>
              <p className="mt-1 text-xs text-steel">先 AI 生成标题/卖点/图，再发布</p>
            </div>
          </div>

          {/* 上架前检查清单 */}
          <div className="mt-4 rounded-lg border border-line p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-steel">上架前检查</p>
            <ul className="space-y-1">
              {buildUploadChecklist({
                title: product.title,
                description: product.description,
                price: product.price,
                images: product.images
              }).map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-xs">
                  <span className={item.passed ? "text-green-600" : "text-red-600"}>{item.passed ? "✓" : "✗"}</span>
                  <span className="font-semibold text-ink">{item.label}</span>
                  <span className="text-steel">{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <ProductUploadForm productId={product.id} stores={stores} defaultStoreId={product.storeId ?? ""} />
          </div>
        </section>

        {/* 模块3: AI 优化 */}
        <section className="ledger-card p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 3 · AI 优化</p>
            <h3 className="mt-1 font-display text-2xl">标题 / 卖点 / 描述 / FAQ / SEO</h3>
          </div>
          <ProductAiButtons productId={product.id} />
        </section>

        {/* 模块4: 素材中心 */}
        <section className="ledger-card p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 4 · 素材中心</p>
            <h3 className="mt-1 font-display text-2xl">主图 / 广告图 / Banner</h3>
          </div>
          <AiGeneratedImagePanel productId={product.id} productImages={images} images={generatedImages} initialPrompt={latestInferredPrompt} />
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-bold text-steel">图片工作台</p>
            <ProductImageManager productId={product.id} title={product.title} images={images} />
          </div>
        </section>

        {/* 模块5: 视频中心 */}
        <section className="ledger-card p-5" style={{ opacity: 0.7 }}>
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 5 · 视频中心</p>
            <h3 className="mt-1 font-display text-2xl">脚本 / 分镜 / 短视频</h3>
          </div>
          <p className="text-sm text-steel">V3 P5 阶段开放。将支持视频脚本生成、分镜规划、短视频生成。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-line p-3 text-xs text-steel">视频脚本 · 待开放</div>
            <div className="rounded-lg border border-dashed border-line p-3 text-xs text-steel">分镜规划 · 待开放</div>
          </div>
        </section>

        {/* 模块6: 推广中心 */}
        <section className="ledger-card p-5">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-steel">模块 6 · 推广中心</p>
            <h3 className="mt-1 font-display text-2xl">VK / Wibes</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/content" className="rounded-lg border border-line p-3 hover:bg-rail/40">
              <strong className="text-sm">VK 发布</strong>
              <p className="mt-1 text-xs text-steel">文案 / 图片 / 视频 · 立即或定时</p>
            </Link>
            <div className="rounded-lg border border-dashed border-line p-3" style={{ opacity: 0.6 }}>
              <strong className="text-sm">Wibes</strong>
              <p className="mt-1 text-xs text-steel">筹备中 · 即将开放</p>
            </div>
          </div>
        </section>
      </div>

      {/* 任务状态 */}
      <section className="ledger-card mt-5 p-5">
        <h3 className="font-display text-2xl">任务状态</h3>
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
    </AppShell>
  );
}
