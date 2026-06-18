"use client";

import { useTransition, useState } from "react";
import { generateAssetAi, generateProductAi, generateSocialAi, type AiResult } from "@/app/ai-studio/actions";

type ProductOption = { id: string; title: string };
type Tab = "product" | "asset" | "video" | "social";

export function AiStudioClient({ products, imageCredits, videoCredits }: {
  products: ProductOption[];
  imageCredits: number;
  videoCredits: number;
}) {
  const [tab, setTab] = useState<Tab>("product");
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "product", label: "商品 AI" },
    { key: "asset", label: "素材 AI" },
    { key: "video", label: "视频 AI" },
    { key: "social", label: "社媒 AI" }
  ];

  return (
    <div>
      <div className="ai-studio-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`ai-studio-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ai-studio-panel">
        {tab === "product" && <ProductAiPanel products={products} />}
        {tab === "asset" && <AssetAiPanel credits={imageCredits} />}
        {tab === "video" && <VideoAiPanel credits={videoCredits} />}
        {tab === "social" && <SocialAiPanel products={products} />}
      </div>
    </div>
  );
}

function ResultBlock({ result }: { result: AiResult | null }) {
  if (!result) return null;
  if (!result.ok) {
    return <div className="ai-studio-error">{result.message}</div>;
  }
  return (
    <div className="ai-studio-result">
      <p className="ai-studio-result-title">{result.message}</p>
      {result.content && (
        <pre className="ai-studio-result-content">{result.content}</pre>
      )}
      {result.imageUrl && (
        <div className="ai-studio-result-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.imageUrl} alt="AI 生成结果" />
        </div>
      )}
    </div>
  );
}

function ProductAiPanel({ products }: { products: ProductOption[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiResult | null>(null);
  const [kind, setKind] = useState("title");

  if (products.length === 0) {
    return <p className="ai-studio-hint">请先在商品中心添加商品，再使用商品 AI。</p>;
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setResult(await generateProductAi(formData));
        });
      }}
      className="ai-studio-form"
    >
      <label>
        <span>选择商品</span>
        <select name="productId" className="field" defaultValue={products[0]?.id}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.title.slice(0, 40)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>生成类型</span>
        <select name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="title">商品标题</option>
          <option value="sellingPoints">卖点</option>
          <option value="description">详情描述</option>
          <option value="faq">FAQ</option>
          <option value="seo">SEO 关键词</option>
        </select>
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending ? "生成中..." : "生成"}
      </button>
      <ResultBlock result={result} />
    </form>
  );
}

function AssetAiPanel({ credits }: { credits: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiResult | null>(null);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setResult(await generateAssetAi(formData));
        });
      }}
      className="ai-studio-form"
    >
      <p className="ai-studio-hint">剩余图片额度：{credits} 张</p>
      <label>
        <span>素材类型</span>
        <select name="assetType" className="field" defaultValue="主图">
          <option value="主图">主图</option>
          <option value="广告图">广告图</option>
          <option value="Banner">Banner</option>
          <option value="海报">海报</option>
          <option value="详情页">详情页</option>
          <option value="品牌KV">品牌 KV</option>
        </select>
      </label>
      <label>
        <span>生成需求</span>
        <textarea
          name="prompt"
          className="field"
          rows={3}
          placeholder="描述你要生成的营销素材，如：保温杯产品图，白色背景，突出温显功能"
        />
      </label>
      <button className="btn-primary" disabled={pending || credits <= 0}>
        {pending ? "生成中（约10-30秒）..." : `生成（消耗 1 张额度）`}
      </button>
      <ResultBlock result={result} />
    </form>
  );
}

function VideoAiPanel({ credits }: { credits: number }) {
  return (
    <div className="ai-studio-placeholder">
      <h3>视频 AI · 筹备中</h3>
      <p>V3 P5 阶段开放，将支持：</p>
      <ul>
        <li>视频脚本生成</li>
        <li>分镜规划</li>
        <li>短视频生成（消耗视频额度，当前 {credits} 条）</li>
      </ul>
    </div>
  );
}

function SocialAiPanel({ products }: { products: ProductOption[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiResult | null>(null);
  const [mode, setMode] = useState<"product" | "topic">("product");

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setResult(await generateSocialAi(formData));
        });
      }}
      className="ai-studio-form"
    >
      <label>
        <span>平台</span>
        <select name="platform" className="field" defaultValue="vk">
          <option value="vk">VK</option>
          <option value="wibus">Wibes</option>
        </select>
      </label>
      <label>
        <span>内容类型</span>
        <select name="kind" className="field" defaultValue="caption">
          <option value="title">标题</option>
          <option value="caption">文案</option>
          <option value="tags">标签</option>
        </select>
      </label>
      <label>
        <span>来源</span>
        <select name="mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as "product" | "topic")}>
          <option value="product">关联商品</option>
          <option value="topic">自定义主题</option>
        </select>
      </label>
      {mode === "product" ? (
        <label>
          <span>选择商品</span>
          <select name="productId" className="field" defaultValue={products[0]?.id || ""}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title.slice(0, 40)}</option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>推广主题</span>
          <input name="topic" className="field" placeholder="如：冬季保温杯促销" />
        </label>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "生成中..." : "生成"}
      </button>
      <ResultBlock result={result} />
    </form>
  );
}
