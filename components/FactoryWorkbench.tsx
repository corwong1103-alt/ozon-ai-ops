"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ImageIcon, Languages, FileText, Tags,
  Globe, Save, Search, Wand2, Rocket
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

const DEFAULT_NEGATIVE_PROMPT = "blurry, distorted text, deformed logos, low resolution, watermark, extra objects, text overlay";

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
  const [imageStrength, setImageStrength] = useState(0.35);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [inferredPrompt, setInferredPrompt] = useState("");
  const [inferImageUrl, setInferImageUrl] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const callAi = useCallback(async (action: string, body: Record<string, unknown>) => {
    setLoading(action);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) { toast("error", data.error); return null; }
      return data;
    } catch (e: any) {
      if (e.name === "AbortError") toast("error", "AI 请求超时（60s），请重试。");
      else toast("error", "AI 调用失败");
      return null;
    } finally {
      clearTimeout(timeout);
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
  const imagePromptBase = `Product: ${title}\nDescription: ${description}\nKeep the original product identity, proportions, colors, material, packaging, and label layout.`;
  const imageActions = [
    {
      key: "img_optimize",
      label: "优化主图",
      strength: 0.35,
      prompt: `Create a realistic Ozon ecommerce main image.\n${imagePromptBase}\nEnvironment: pure white background, product centered, clean tabletop shadow.\nStyle: professional product photography, sharp focus, natural light.`
    },
    {
      key: "img_bg",
      label: "替换背景",
      strength: 0.4,
      prompt: `Create a clean ecommerce background replacement.\n${imagePromptBase}\nEnvironment: light premium studio background, subtle realistic shadow.\nStyle: commercial product photography, no text overlay.`
    },
    {
      key: "img_model",
      label: "生成模特图",
      strength: 0.55,
      prompt: `Create a realistic model usage image for Russian ecommerce buyers.\n${imagePromptBase}\nEnvironment: natural lifestyle setting with the product clearly visible.\nStyle: credible everyday photography, correct scale, natural lighting.`
    },
    {
      key: "img_scene",
      label: "生成场景图",
      strength: 0.55,
      prompt: `Create a realistic product usage scene.\n${imagePromptBase}\nEnvironment: modern home usage scene, simple supporting context.\nStyle: lifestyle ecommerce photography, product remains the visual focus.`
    }
  ];

  async function generateImageFromPrompt(action: string, prompt: string, strength: number) {
    setImagePrompt(prompt);
    setImageStrength(strength);
    const data = await callAi(action, {
      mode: "image",
      prompt,
      referenceImage: referenceImage || undefined,
      strength,
      negativePrompt
    });
    if (data?.imageUrl) setGeneratedImageUrl(data.imageUrl);
  }

  return (
    <div className="pb-24">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      {/* ── LEFT: Raw Product ── */}
      <div className="w-full space-y-4 xl:sticky xl:top-24">
        <div className="rounded-xl border border-clay bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-rail px-2 py-0.5 text-[10px] font-semibold text-steel">{sourceLabel}</span>
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
          <div className="mt-4 grid gap-2 border-t border-clay pt-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-steel">价格</span>
              <strong className="text-earth">¥{Number(product.price).toFixed(2)} {product.currency}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-steel">SKU</span>
              <strong className="text-earth">待确认</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-steel">供应商</span>
              <strong className="text-earth">{sourceLabel}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: AI Workbench ── */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="rounded-xl border border-clay bg-white p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="section-kicker">AI Workspace</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-earth">统一制作商品资料</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">标题、描述、翻译、图片、属性、SEO 和价格建议都在这里完成。每次只选择一个动作。</p>
            </div>
            <button className="btn-primary text-xs" onClick={() => setActivePanel("batch")} type="button">
              <Sparkles size={13} /> 一键优化
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-rail/60 p-1 w-fit">
          {([
            { key: "copy", label: "标题与描述", icon: FileText },
            { key: "image", label: "商品图片", icon: ImageIcon },
            { key: "infer", label: "图片 Prompt", icon: Wand2 },
            { key: "batch", label: "一键优化", icon: Sparkles },
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
        </div>

        {/* Panel: AI Copy */}
        {activePanel === "copy" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Languages size={15} className="text-accent" />标题、描述与翻译</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_title", { mode: "text", prompt: `生成一个优化的俄语商品标题：${title}` });
                if (data?.text) setGeneratedTitle(data.text);
              }} disabled={loading === "translate_title"}>
                <Languages size={13} /> 优化标题
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_desc", { mode: "text", prompt: `生成详细的俄语商品描述，含卖点：${description}` });
                if (data?.text) setGeneratedDesc(data.text);
              }} disabled={loading === "translate_desc"}>
                <FileText size={13} /> 优化描述
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_selling", { mode: "text", prompt: `提取商品核心卖点（3-5点俄语）：${title} ${description}` });
                if (data?.text) setGeneratedSeo(data.text);
              }} disabled={loading === "translate_selling"}>
                <Tags size={13} /> 优化属性
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_seo", { mode: "text", prompt: `生成5-10个俄语SEO关键词：${title}` });
                if (data?.text) setGeneratedSeo(data.text);
              }} disabled={loading === "translate_seo"}>
                <Search size={13} /> 生成SEO
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_ru", { mode: "text", prompt: `翻译为俄语：${title}` });
                if (data?.text) setGeneratedRuTitle(data.text);
              }} disabled={loading === "translate_ru"}>
                <Globe size={13} /> 翻译俄语
              </button>
              <button className="btn-secondary text-xs" onClick={async () => {
                const data = await callAi("translate_en", { mode: "text", prompt: `Translate to English: ${title}` });
                if (data?.text) setGeneratedEnTitle(data.text);
              }} disabled={loading === "translate_en"}>
                <Globe size={13} /> 价格建议
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
                  应用到商品
                </button>
              </div>
            )}
          </div>
        )}

        {/* Panel: AI Image */}
        {activePanel === "image" && (
          <div className="space-y-3 rounded-xl border border-clay bg-white p-5">
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><ImageIcon size={15} className="text-accent" />生成图片</h3>
            <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="rounded-lg border border-clay bg-rail/30 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase text-steel">参考图</p>
                {referenceImage ? (
                  <img src={referenceImage} alt="Reference product" className="aspect-square w-full rounded-md object-cover" />
                ) : (
                  <div className="grid aspect-square w-full place-items-center rounded-md bg-white text-xs text-steel">暂无参考图</div>
                )}
              </div>
              <div className="space-y-3 rounded-lg border border-clay bg-rail/30 p-3">
                <label className="block text-xs font-semibold text-steel">
                  保留原图强度 {imageStrength.toFixed(2)}
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.05"
                    value={imageStrength}
                    onChange={(event) => setImageStrength(Number(event.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
                <label className="block text-xs font-semibold text-steel">
                  负面词
                  <textarea
                    className="field mt-1 min-h-16 text-xs"
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {imageActions.map((action) => (
                <button
                  key={action.key}
                  className="btn-secondary text-xs"
                  onClick={() => generateImageFromPrompt(action.key, action.prompt, action.strength)}
                  disabled={loading === action.key || !referenceImage}
                >
                  <ImageIcon size={13} /> {action.label}
                </button>
              ))}
              <button
                className="btn-secondary text-xs sm:col-span-2"
                onClick={() => generateImageFromPrompt("img_custom", imagePrompt || imageActions[0].prompt, imageStrength)}
                disabled={loading === "img_custom" || !referenceImage}
              >
                <ImageIcon size={13} /> 按当前强度重新生成
              </button>
            </div>

            {generatedImageUrl && (
              <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
                <p className="text-[10px] font-bold uppercase text-steel mb-2">原图 / AI 生成图</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {referenceImage && <img src={referenceImage} alt="Reference product" className="w-full rounded-lg object-contain" />}
                  <img src={generatedImageUrl} alt="AI generated" className="w-full rounded-lg object-contain" />
                </div>
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
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Wand2 size={15} className="text-accent" />图片 Prompt</h3>
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
                    const data = await callAi("infer_image", {
                      mode: "image",
                      prompt: inferredPrompt,
                      referenceImage: referenceImage || undefined,
                      strength: imageStrength,
                      negativePrompt
                    });
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
            <h3 className="text-sm font-semibold text-earth flex items-center gap-2"><Sparkles size={15} className="text-accent" />一键优化</h3>
            <p className="text-xs text-steel">对当前商品执行完整 AI Workspace 流程。</p>
            <div className="grid gap-2">
              <button className="btn-primary text-xs" disabled>
                <Sparkles size={13} /> 一键优化图片
              </button>
              <button className="btn-primary text-xs" disabled>
                <FileText size={13} /> 一键优化文案
              </button>
            </div>
            <p className="text-[10px] text-steel/60">批量能力开发中，请先用上方 AI Workspace 单步操作。</p>
          </div>
        )}
      </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-clay bg-sand/90 px-4 py-3 backdrop-blur-xl lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-secondary">
            <Save size={15} />
            {saving ? "保存中…" : "保存草稿"}
          </button>
          <button onClick={() => router.push(`/products/${product.id}`)} className="btn-primary">
            <Rocket size={15} />
            立即发布
          </button>
        </div>
      </div>
    </div>
  );
}
