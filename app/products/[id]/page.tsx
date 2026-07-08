import { notFound } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { AiGeneratedImagePanel } from "@/components/AiGeneratedImagePanel";
import { ProductEditForm, ProductPrimaryAction } from "@/components/ProductActionControls";
import { ProductImageManager } from "@/components/ProductImageManager";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { SELLER_WORKFLOW_STEPS, getSellerWorkflowStep, productStatusLabel } from "@/lib/product-lifecycle";
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

function readOptimizedText(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const optimized = value.optimized;
  return typeof optimized === "string" ? optimized : "";
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
  const currentStep = getSellerWorkflowStep(product.status);
  const generatedImages = tasks
    .filter((task) => task.type === "image")
    .flatMap((task) => collectGeneratedImageUrls(task.metadata).map((url) => ({
      url, status: task.status, createdAt: task.createdAt.toISOString()
    })))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  const latestInferredPrompt = tasks.map((task) => readInferredPrompt(task.metadata)).find(Boolean) || "";
  const latestOptimizedText = tasks.map((task) => readOptimizedText(task.metadata)).find(Boolean) || "";

  return (
    <AppShell title={product.title} eyebrow={`${currentStep.label} / ${productStatusLabel(product.status)}`} user={user}>
      <section className="seller-page pb-24">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Product Detail</span>
            <h2>{currentStep.next}</h2>
            <p>左侧确认原始信息，右侧检查 AI Workspace 输出。页面底部只保留保存和主流程动作。</p>
          </div>
          <Link href="/factory" className="btn-secondary">返回商品制作</Link>
        </div>

        <div className="seller-workflow">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.label} className={`seller-workflow-step ${index === currentStep.index ? "is-active" : ""}`}>
              <span>STEP {index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <section className="ledger-card p-5">
            <div className="mb-4">
              <span className="status-chip">{productStatusLabel(product.status)}</span>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-earth">商品原始信息</h3>
              <p className="mt-2 text-sm leading-6 text-steel">图片、标题、描述、SKU、供应商和价格在这里确认。</p>
            </div>
            <ProductEditForm
              productId={product.id}
              title={product.title}
              description={product.description}
              price={Number(product.price)}
              imagesText={imagesToText(product.images)}
            />
          </section>

          <section className="ledger-card p-5">
            <div className="mb-4">
              <p className="section-kicker">AI Workspace</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-earth">确认 AI 生成结果</h3>
              <p className="mt-2 text-sm leading-6 text-steel">标题、描述、图片、属性、SEO 和价格建议统一在这里检查。</p>
            </div>

            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-earth">AI 标题与描述</h4>
                {latestOptimizedText ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-rail/40 p-4 text-sm leading-6 text-ink">{latestOptimizedText}</pre>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-steel">暂未生成 AI 文案。回到商品制作页继续制作。</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-earth">AI 图片</h4>
                <div className="mt-3">
                  <AiGeneratedImagePanel productId={product.id} productImages={images} images={generatedImages} initialPrompt={latestInferredPrompt} />
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  <ProductImageManager productId={product.id} title={product.title} images={images} />
                </div>
              </div>

              <div className="rounded-lg border border-line p-4">
                <h4 className="text-sm font-semibold text-earth">发布前检查</h4>
                <ul className="mt-3 space-y-2">
                  {buildUploadChecklist({
                    title: product.title,
                    description: product.description,
                    price: product.price,
                    images: product.images
                  }).map((item) => (
                    <li key={item.key} className="flex items-start gap-2 text-xs">
                      <span className={item.passed ? "text-green-600" : "text-red-600"}>{item.passed ? "✓" : "✗"}</span>
                      <span>
                        <strong className="text-ink">{item.label}</strong>
                        <span className="ml-2 text-steel">{item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-clay bg-sand/90 px-4 py-3 backdrop-blur-xl lg:left-60">
        <div className="mx-auto grid max-w-6xl gap-2 md:grid-cols-[1fr_auto] md:items-center">
          <p className="text-xs text-steel">当前步骤：{currentStep.label}。下一步：{currentStep.next}。</p>
          <div className="min-w-[260px]">
            <ProductPrimaryAction
              productId={product.id}
              status={product.status}
              stores={stores}
              defaultStoreId={product.storeId ?? ""}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
