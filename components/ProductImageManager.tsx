"use client";

import { useState, useTransition } from "react";
import { GripVertical, ImagePlus, Trash2, X } from "lucide-react";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { useToast } from "@/components/Toast";
import {
  removeProductImage,
  reorderProductImageTo,
  replaceProductImageUrl
} from "@/app/products/actions";

export function ProductImageManager({
  productId,
  title,
  images
}: {
  productId: string;
  title: string;
  images: string[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useToast();
  const activeImage = images[activeIndex] ? [images[activeIndex], ...images.filter((_, index) => index !== activeIndex)] : images;

  if (images.length === 0) {
    return (
      <section className="image-workbench">
        <div className="image-workbench-empty">
          <p className="text-sm font-bold text-ink">暂无商品图</p>
          <p className="mt-2 text-sm leading-6 text-steel">在左侧粘贴真实 Ozon 或 1688 商品图 URL 后保存，这里会出现可编辑图片墙。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="image-workbench">
      <div className="image-hero-frame">
        <ReliableProductImage images={activeImage} alt={title} className="h-full w-full object-contain" priority />
        <div className="image-hero-meta">
          <strong>{activeIndex === 0 ? "主图" : `第 ${activeIndex + 1} 张`}</strong>
          <span>拖动下方图片即可排序</span>
        </div>
      </div>

      <div className="image-strip">
        {images.map((image, index) => (
          <div
            key={`${image}_${index}`}
            className={`image-tile ${index === activeIndex ? "is-active" : ""} ${index === dragOverIndex ? "is-drop-target" : ""}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverIndex(index);
            }}
            onDrop={() => {
              if (dragIndex === null || dragIndex === index) return;
              startTransition(async () => {
                await reorderProductImageTo(productId, dragIndex, index);
                toast("success", "图片排序已更新。");
              });
              setActiveIndex(index);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
          >
            <button type="button" className="image-tile-preview" onClick={() => setActiveIndex(index)}>
              <ReliableProductImage images={[image]} alt={`${title} 图片 ${index + 1}`} className="h-full w-full object-cover" />
            </button>

            <div className="image-tile-toolbar">
              <span className="image-order-label">
                <GripVertical size={14} />
                {index === 0 ? "主图" : index + 1}
              </span>
              <button type="button" className="image-tool-button" onClick={() => setReplaceIndex(replaceIndex === index ? null : index)} title="替换">
                <ImagePlus size={14} />
              </button>
              <button
                type="button"
                className="image-tool-button danger"
                title="删除"
                onClick={() => {
                  startTransition(async () => {
                    await removeProductImage(productId, index);
                    toast("success", "图片已删除。");
                  });
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>

            {replaceIndex === index && (
              <form
                className="image-replace-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  startTransition(async () => {
                    await replaceProductImageUrl(productId, index, new FormData(form));
                    setReplaceIndex(null);
                    toast("success", "图片已替换。");
                  });
                }}
              >
                <div className="image-replace-head">
                  <span>替换真实图片 URL</span>
                  <button type="button" onClick={() => setReplaceIndex(null)} aria-label="关闭替换面板">
                    <X size={14} />
                  </button>
                </div>
                <input className="field py-2 text-xs" name="imageUrl" defaultValue={image} aria-label={`替换第 ${index + 1} 张图片 URL`} />
                <button className="btn-primary px-3 py-2 text-xs">确认</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
