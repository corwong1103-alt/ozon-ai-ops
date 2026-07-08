"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addToProductPool,
  confirmProductReady,
  generatePromotionDraft,
  generateProductImage,
  generateProductVideo,
  optimizeProductMainFlow,
  translateImageText,
  translateProduct,
  updateProduct,
  uploadProduct
} from "@/app/products/actions";
import { useToast } from "@/components/Toast";
import { getProductNextAction } from "@/lib/product-main-flow";

function useActionFeedback() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message: string } | undefined>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.ok) {
          toast("success", result.message);
          router.refresh();
          return;
        }
        toast("error", result?.message || "操作失败，请稍后再试。");
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "操作失败，请稍后再试。");
      }
    });
  }

  return { pending, run };
}

export function ProductEditForm({
  productId,
  title,
  description,
  price,
  imagesText
}: {
  productId: string;
  title: string;
  description: string;
  price: number;
  imagesText: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, run } = useActionFeedback();

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = formRef.current;
        if (!form) return;
        run(() => updateProduct(productId, new FormData(form)));
      }}
    >
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">商品标题</span>
        <input className="field" name="title" defaultValue={title} required />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">商品描述</span>
        <textarea className="field min-h-36" name="description" defaultValue={description} required />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">商品价格</span>
        <input className="field" name="price" type="number" min="0" step="0.01" defaultValue={price} required />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">批量图片 URL</span>
        <textarea className="field min-h-28" name="images" defaultValue={imagesText} />
        <span className="mt-2 block text-xs leading-5 text-steel">
          日常排序、删除、替换请直接用右侧图片墙。这里适合一次性粘贴多张真实来源图。
        </span>
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending ? "保存中…" : "保存商品"}
      </button>
    </form>
  );
}

export function ProductAiButtons({ productId }: { productId: string }) {
  const translate = useActionFeedback();
  const imageText = useActionFeedback();
  const image = useActionFeedback();
  const video = useActionFeedback();

  return (
    <div className="mt-6 grid gap-3 border-t border-line pt-5 md:grid-cols-2">
      <button className="btn-secondary w-full" disabled={translate.pending} onClick={() => translate.run(() => translateProduct(productId))} type="button">
        {translate.pending ? "翻译中…" : "标题/描述翻译俄文"}
      </button>
      <button className="btn-secondary w-full" disabled={imageText.pending} onClick={() => imageText.run(() => translateImageText(productId))} type="button">
        {imageText.pending ? "生成中…" : "图片文字翻译俄文"}
      </button>
      <button className="btn-primary w-full" disabled={image.pending} onClick={() => image.run(() => generateProductImage(productId))} type="button">
        {image.pending ? "生成中…" : "AI商品图生成"}
      </button>
      <button className="btn-primary w-full opacity-60" disabled={video.pending} onClick={() => video.run(() => generateProductVideo(productId))} type="button">
        AI视频暂停
      </button>
    </div>
  );
}

export function ProductPrimaryAction({
  productId,
  status,
  stores,
  defaultStoreId
}: {
  productId: string;
  status: string;
  stores: Array<{ id: string; name: string; ozonStoreId: string }>;
  defaultStoreId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, run } = useActionFeedback();
  const action = getProductNextAction(status, productId);

  function execute() {
    if (action.intent === "pool") {
      run(() => addToProductPool(productId));
      return;
    }
    if (action.intent === "optimize" || action.intent === "progress") {
      run(() => optimizeProductMainFlow(productId));
      return;
    }
    if (action.intent === "confirm") {
      run(() => confirmProductReady(productId));
      return;
    }
    if (action.intent === "promote") {
      run(() => generatePromotionDraft(productId));
      return;
    }
    if (action.intent === "publish") {
      const form = formRef.current;
      if (!form) return;
      run(() => uploadProduct(productId, new FormData(form)));
    }
  }

  const disabled = pending || action.intent === "archived" || (action.intent === "publish" && stores.length === 0);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        execute();
      }}
    >
      {action.intent === "publish" && (
        <select className="field" name="storeId" required defaultValue={defaultStoreId}>
          <option value="">选择 Ozon 店铺</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name} / {store.ozonStoreId}
            </option>
          ))}
        </select>
      )}
      <button className="btn-primary w-full" disabled={disabled} type="submit">
        {pending ? "处理中…" : stores.length === 0 && action.intent === "publish" ? "先绑定 Ozon 店铺" : action.label}
      </button>
      <p className="text-xs text-steel">唯一主流程：发现商品 → 制作商品 → 确认商品 → 发布商品。</p>
    </form>
  );
}

export function ProductUploadForm({
  productId,
  stores,
  defaultStoreId
}: {
  productId: string;
  stores: Array<{ id: string; name: string; ozonStoreId: string }>;
  defaultStoreId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, run } = useActionFeedback();

  return (
    <form
      ref={formRef}
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = formRef.current;
        if (!form) return;
        run(() => uploadProduct(productId, new FormData(form)));
      }}
    >
      <select className="field" name="storeId" required defaultValue={defaultStoreId}>
        <option value="">选择店铺</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name} / {store.ozonStoreId}
          </option>
        ))}
      </select>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "处理中…" : "上架到 Ozon（dry-run 模拟）"}
      </button>
      <p className="text-xs text-steel">默认 dry-run 模式不真实写入 Ozon。设置 OZON_REAL_UPLOAD=true 开启真实上架。</p>
    </form>
  );
}
