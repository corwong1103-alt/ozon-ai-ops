"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addGeneratedImageToProduct, generateProductImageFromPrompt, inferImagePromptFromProduct } from "@/app/products/actions";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { useToast } from "@/components/Toast";

export function AiGeneratedImagePanel({
  productId,
  productImages,
  images,
  initialPrompt = ""
}: {
  productId: string;
  productImages: string[];
  images: Array<{ url: string; createdAt: string; status: string }>;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [referenceImage, setReferenceImage] = useState(productImages[0] || "");

  return (
    <section className="ledger-card overflow-hidden">
      <div className="relative border-b border-line px-5 py-4">
        <p className="text-xs font-bold text-accent">AI 生成参考区</p>
        <h3 className="mt-1 font-display text-2xl">先看效果，再加入商品图</h3>
        <p className="mt-2 text-sm leading-6 text-steel">点击“AI商品图生成”后，成功返回的图片会出现在这里。确认可用后加入图片墙，再进入上架。</p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-line bg-rail/50 p-4 md:col-span-2">
          <div>
            <p className="text-xs font-bold text-accent">提示词生图</p>
            <h4 className="mt-1 font-display text-xl text-ink">参考原图反推提示词，再生成新商品图</h4>
            <p className="mt-1 text-sm leading-6 text-steel">
              先用商品标题、描述和原图链接反推提示词；你可以手动修改，再点击“用提示词生图”。
            </p>
          </div>
          {productImages.length > 0 && (
            <div className="ai-reference-strip">
              {productImages.slice(0, 8).map((image, index) => (
                <button
                  key={`${image}_${index}`}
                  className={referenceImage === image ? "active" : ""}
                  onClick={() => setReferenceImage(image)}
                  type="button"
                  aria-label={`选择第 ${index + 1} 张原图作为参考`}
                >
                  <ReliableProductImage images={[image]} alt={`参考原图 ${index + 1}`} className="h-full w-full object-cover" />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            className="field min-h-32"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：电商商品摄影，一瓶头发生长精华，干净浅色背景，柔和棚拍光，突出瓶身标签和质感，Ozon 主图风格，无手持，无杂乱文字..."
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await inferImagePromptFromProduct(productId, referenceImage);
                    if (result?.ok && result.prompt) {
                      setPrompt(result.prompt);
                      toast("success", result.message);
                      router.refresh();
                      return;
                    }
                    toast("error", result?.message || "反推提示词失败。");
                  } catch (error) {
                    toast("error", error instanceof Error ? error.message : "反推提示词失败。");
                  }
                });
              }}
              type="button"
            >
              {pending ? "处理中…" : "引用原图反推提示词"}
            </button>
            <button
              className="btn-primary px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await generateProductImageFromPrompt(productId, prompt);
                    if (result?.ok) {
                      toast("success", result.message);
                      router.refresh();
                      return;
                    }
                    toast("error", result?.message || "生图失败。");
                  } catch (error) {
                    toast("error", error instanceof Error ? error.message : "生图失败。");
                  }
                });
              }}
              type="button"
            >
              {pending ? "生成中…" : "用提示词生图"}
            </button>
          </div>
        </div>

        {images.length === 0 && (
          <div className="border border-dashed border-line bg-rail p-5 text-sm leading-6 text-steel md:col-span-2">
            暂无 AI 生成图。左侧点击“AI商品图生成”后，这里会显示生成结果。
          </div>
        )}
        {images.map((item) => (
          <div key={`${item.url}_${item.createdAt}`} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
            <div className="aspect-square bg-rail">
              <ReliableProductImage images={[item.url]} alt="AI 生成商品图" className="h-full w-full object-contain" />
            </div>
            <div className="space-y-2 p-3">
              <p className="text-xs text-steel">{new Date(item.createdAt).toLocaleString("zh-CN")} / {item.status}</p>
              <button
                className="btn-primary w-full px-3 py-2 text-xs"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const result = await addGeneratedImageToProduct(productId, item.url);
                      if (result?.ok) {
                        toast("success", result.message);
                        router.refresh();
                        return;
                      }
                      toast("error", result?.message || "加入失败。");
                    } catch (error) {
                      toast("error", error instanceof Error ? error.message : "加入失败。");
                    }
                  });
                }}
                type="button"
              >
                {pending ? "加入中…" : "加入商品图"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
