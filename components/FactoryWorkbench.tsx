"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ImageIcon, Languages, FileText, Tags,
  Globe, Save, Search, ArrowLeft, Wand2
} from "lucide-react";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { imageList } from "@/lib/product-images";
import { useToast } from "@/components/Toast";

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: unknown;
  status: string;
  source: string;
};

export function FactoryWorkbench({ product }: { product: Product }) {
  const router = useRouter();
  const { toast } = useToast();
  const images = imageList(product.images);
  const referenceImage = images.length > 0 ? images[0] : "";
  const [currentImgIdx, setCurrentImgIdx] = useState(0);

  const [activePanel, setActivePanel] = useState<"copy" | "image" | "infer" | "batch">("copy");
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedDesc, setGeneratedDesc] = useState("");
  const [generatedSeo, setGeneratedSeo] = useState("");
  const [generatedRuTitle, setGeneratedRuTitle] = useState("");
  const [generatedEnTitle, setGeneratedEnTitle] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [inferredPrompt, setInferredPrompt] = useState("");
  const [inferImageUrl, setInferImageUrl] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const callAi = useCallback(async (action: string, body: Record<string, unknown>) => {
    setLoading(action);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) { toast("error", data.error); return null; }
      return data;
    } catch {
      toast("error", "AI 调用失败");
      return null;
    } finally {
      setLoading(null);
    }
  }, [toast]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", String(product.price));
      formData.append("images", images.join("\n"));
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, price: product.price }),
      });
      if (res.ok) {
        toast("success", "草稿已保存");
        router.refresh();
      }
    } catch {
      toast("error", "保存失败");
    } finally {
      setSaving(false);
    }
  }, [title, description, product, images, toast, router]);

  const sourceLabel = product.source === "source_1688" ? "1688" : product.source === "ozon_market" ? "Ozon Market" : product.source === "ozon" ? "Ozon 店铺" : "手动";

  return (
    <div className="flex items-start gap-4 lg:flex-row flex-col">
      {/* ── LEFT: Raw Product ── */}
      <div className="w-full lg:w-[380px] lg:sticky lg:top-20 shrink-0 space-y-4">
        <div className="rounded-xl border border-clay bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-rail px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-steel">{sourceLabel}</span>
            <span className="text-xs text-steel">{images.length} 张图</span>
          </div>

          {images.length > 0 ? (
            <div>
              <div className="relative">
                <ReliableProductImage images={[images[currentImgIdx]]} alt={title} className="mb-3 aspect-square w-full rounded-lg object-cover" emptyLabel="无图" />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setCurrentImgIdx(i => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-white/80 shadow">‹</button>
                    <button onClick={() => setCurrentImgIdx(i => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-white/80 shadow">›</button>
                  </>
                )}
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">{currentImgIdx + 1}/{images.length}</span>
              </div>
              {images.length > 1 && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {images.slice(0, 8).map((img, i) => (
                    <button key={i} onClick={() => setCurrentImgIdx(i)} className={`h-12 w-12 shrink-0 rounded-md border-2 overflow-hidden ${i === currentImgIdx ? "border-accent" : "border-transparent"}`}>
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-lg bg-rail/60 text-xs text-steel">无图片</div>
          )}

          <h2 className="text-sm font-semibold leading-snug text-earth">{title}</h2>
          <p className="mt-2 text-xs leading-relaxed text-steel line-clamp-4">{description}</p>
          <div className="mt-3 flex items-center justify-between border-t border-clay pt-3">
            <span className="text-base font-bold text-earth">¥{Number(product.price).toFixed(2)}</span>
            <span className="text-xs text-steel">{product.currency}</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={15} />
            {saving ? "保存中…" : "保存草稿"}
          </button>
          <button onClick={() => router.push("/factory/drafts")} className="btn-secondary w-full flex items-center justify-center gap-2 text-xs">
            <FileText size={14} />
            查看草稿箱
          </button>
        </div>
      </div>

      {/* ── RIGHT: AI Workbench ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Panel Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-rail/60 p-1 w-fit">
          {([
            { key: "copy", label: "AI 文案", icon: FileText },
            { key: "image", label: "AI 图片", icon: ImageIcon },
            { key: "infer", label: "图片反推", icon: Wand2 },
            { key: "batch", label: "批量处理", icon: Sparkles },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activePanel === tab.key ? "bg-white text-earth shadow-sm" : "text-steel hover:text-earth"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel: AI Copy */}
        {activePanel === "copy" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Languages size={15} className="text-accent" />AI 文案生成</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_title", { mode: "text", prompt: `生成一个优化的俄语商品标题：${title}` });
                if (data?.text) setGeneratedTitle(data.text);
              }} disabled={loading === "translate_title"}>
                <Languages size={13} /> 生成标题
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_desc", { mode: "text", prompt: `生成详细的俄语商品描述，含卖点：${description}` });
                if (data?.text) setGeneratedDesc(data.text);
              }} disabled={loading === "translate_desc"}>
                <FileText size={13} /> 生成描述
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_selling", { mode: "text", prompt: `提取商品核心卖点（3-5点俄语）：${title} ${description}` });
                if (data?.text) setGeneratedSeo(data.text);
              }} disabled={loading === "translate_selling"}>
                <Tags size={13} /> 生成卖点
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_seo", { mode: "text", prompt: `生成5-10个俄语SEO关键词：${title}` });
                if (data?.text) setGeneratedSeo(data.text);
              }} disabled={loading === "translate_seo"}>
                <Search size={13} /> 生成SEO关键词
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_ru", { mode: "text", prompt: `翻译为俄语：${title}` });
                if (data?.text) setGeneratedRuTitle(data.text);
              }} disabled={loading === "translate_ru"}>
                <Globe size={13} /> 生成俄文版本
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_en", { mode: "text", prompt: `Translate to English: ${title}` });
                if (data?.text) setGeneratedEnTitle(data.text);
              }} disabled={loading === "translate_en"}>
                <Globe size={13} /> 生成英文版本
              </button>
            </div>

            {/* Generated content */}
            {(generatedTitle || generatedDesc || generatedSeo || generatedRuTitle || generatedEnTitle) && (
              <div className="mt-4 space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                {generatedTitle && <div><p className="text-[10px] font-bold uppercase text-steel">优化标题</p><p className="mt-1 text-sm text-earth">{generatedTitle}</p></div>}
                {generatedDesc && <div><p className="text-[10px] font-bold uppercase text-steel">优化描述</p><p className="mt-1 text-xs text-earth whitespace-pre-wrap">{generatedDesc}</p></div>}
                {generatedSeo && <div><p className="text-[10px] font-bold uppercase text-steel">卖点/SEO</p><p className="mt-1 text-xs text-earth whitespace-pre-wrap">{generatedSeo}</p></div>}
                {generatedRuTitle && <div><p className="text-[10px] font-bold uppercase text-steel">俄文版本</p><p className="mt-1 text-sm text-earth">{generatedRuTitle}</p></div>}
                {generatedEnTitle && <div><p className="text-[10px] font-bold uppercase text-steel">英文版本</p><p className="mt-1 text-sm text-earth">{generatedEnTitle}</p></div>}
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    if (generatedRuTitle) setTitle(generatedRuTitle);
                    if (generatedDesc) setDescription(generatedDesc);
                    toast("success", "已应用 AI 生成内容");
                  }}
                >
                  应用 AI 结果到商品
                </button>
              </div>
            )}
          </div>
        )}

        {/* Panel: AI Image */}
        {activePanel === "image" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><ImageIcon size={15} className="text-accent" />AI 图片处理</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("img_optimize", { mode: "image", prompt: `参考图片URL: ${referenceImage}\n优化这张电商产品图，保持原商品不变，优化背景和光线：${title}`, referenceImage: referenceImage || undefined });
                if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
              }} disabled={loading === "img_optimize"}>
                <ImageIcon size={13} /> 原图优化
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("img_bg", { mode: "image", prompt: `参考图片URL: ${referenceImage}\n替换这张产品图的背景为纯白色电商背景，保持产品清晰：${title}`, referenceImage: referenceImage || undefined });
                if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
              }} disabled={loading === "img_bg"}>
                <ImageIcon size={13} /> 背景替换
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("img_model", { mode: "image", prompt: `参考图片URL: ${referenceImage}\n生成一张俄罗斯模特展示${title}的电商图，自然光线，专业摄影`, referenceImage: referenceImage || undefined });
                if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
              }} disabled={loading === "img_model"}>
                <ImageIcon size={13} /> AI 模特图
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("img_scene", { mode: "image", prompt: `参考图片URL: ${referenceImage}\n生成一张${title}的场景使用图，居家环境，柔和光线`, referenceImage: referenceImage || undefined });
                if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
              }} disabled={loading === "img_scene"}>
                <ImageIcon size={13} /> AI 场景图
              </button>
              <button className="btn-secondary text-xs sm:col-span-2" onClick={async () => {
                const data = await callAi("img_main", { mode: "image", prompt: `参考图片URL: ${referenceImage}\n重新生成一张 Ozon 电商主图：${title}`, referenceImage: referenceImage || undefined });
                if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
              }} disabled={loading === "img_main"}>
                <ImageIcon size={13} /> 重新生成主图
              </button>
            </div>

            {generatedImageUrl && (
              <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
                <p className="text-[10px] font-bold uppercase text-steel mb-2">AI 生成图</p>
                <img src={generatedImageUrl} alt="AI generated" className="w-full rounded-lg" />
                <button className="btn-primary text-xs mt-3" onClick={async () => {
                  try {
                    await fetch(`/api/products/${product.id}/add-image`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrl: generatedImageUrl }),
                    });
                    toast("success", "已添加到商品图片");
                    router.refresh();
                  } catch { toast("error", "添加失败"); }
                }}>添加到商品</button>
              </div>
            )}

            {loading && loading.startsWith("img_") && (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-accent/20 bg-accent/5 p-6">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm font-medium text-earth">AI 正在生成图片...</p>
                <p className="mt-1 text-xs text-steel/60">预计 10~20s，请稍候</p>
              </div>
            )}
          </div>
        )}

        {/* Panel: Image Infer */}
        {activePanel === "infer" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Wand2 size={15} className="text-accent" />图片反推 Prompt</h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-clay bg-rail/40 p-3">
                  <label className="mb-1 block text-xs font-semibold text-steel">方式一：外部图片 URL</label>
                  <input className="field text-xs" placeholder="https://..." value={inferImageUrl} onChange={(e) => setInferImageUrl(e.target.value)} />
                </div>
                <div className="rounded-lg border border-clay bg-rail/40 p-3">
                  <label className="mb-1 block text-xs font-semibold text-steel">方式二：使用商品原图</label>
                  <select className="field text-xs" onChange={(e) => { const v = e.target.value; if (v) setInferImageUrl(v); }}>
                    <option value="">选择商品图片...</option>
                    {images.map((img, i) => (
                      <option key={i} value={img}>图 {i + 1} — {img.slice(0, 50)}...</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn-primary text-xs" onClick={async () => {
                if (!inferImageUrl) { toast("error", "请先输入图片 URL 或选择商品原图"); return; }
                const ref = images.includes(inferImageUrl) ? `商品原图（第${images.indexOf(inferImageUrl)+1}张）` : inferImageUrl;
                const data = await callAi("infer", { mode: "text", prompt: `分析这张电商产品图，生成可用于 AI 生图的中文 Prompt。参考图：${ref}。商品信息：${title}` });
                if (data?.text) setInferredPrompt(data.text);
              }} disabled={loading === "infer"}>
                <Wand2 size={13} /> 生成 Prompt
              </button>
              {loading === "infer" && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-accent/20 bg-accent/5 p-6">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <p className="text-sm font-medium text-earth">AI 正在分析图片...</p>
                  <p className="mt-1 text-xs text-steel/60">预计 5~10s，正在生成反推 Prompt</p>
                </div>
              )}

              {loading === "infer_image" && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-accent/20 bg-accent/5 p-6">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <p className="text-sm font-medium text-earth">AI 正在根据 Prompt 生成图片...</p>
                  <p className="mt-1 text-xs text-steel/60">预计 10~20s，完成后自动显示</p>
                </div>
              )}

              {inferredPrompt && loading !== "infer" && (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-steel mb-1">生成的 Prompt</p>
                  <p className="text-xs text-earth whitespace-pre-wrap">{inferredPrompt}</p>
                  <button className="btn-primary text-xs mt-3" onClick={async () => {
                    const data = await callAi("infer_image", { mode: "image", prompt: inferredPrompt, referenceImage: referenceImage || undefined });
                    if (data?.imageUrl) { setGeneratedImageUrl(data.imageUrl); setActivePanel("image"); }
                  }}>用此 Prompt 生图</button>
                </div>
              )}

              {generatedImageUrl && loading !== "infer_image" && (
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-steel mb-2">AI 生成图</p>
                  <img src={generatedImageUrl} alt="AI generated" className="w-full rounded-lg max-h-80 object-contain" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panel: Batch */}
        {activePanel === "batch" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Sparkles size={15} className="text-accent" />批量处理</h3>
            <p className="text-xs text-steel">对当前商品执行全部 AI 优化流程</p>
            <div className="grid gap-2">
              <button className="btn-primary text-xs" disabled>
                <Sparkles size={13} /> 一键优化全部图片
              </button>
              <button className="btn-primary text-xs" disabled>
                <FileText size={13} /> 一键优化全部文案
              </button>
            </div>
            <p className="text-[10px] text-steel/60">批量功能开发中，请先用上方 AI 面板单步操作</p>
          </div>
        )}
      </div>
    </div>
  );
}
