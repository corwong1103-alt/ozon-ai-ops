import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";
import { createProduct } from "./actions";

const sourceLabel = {
  ozon: "Ozon",
  ozon_market: "Ozon 市场",
  source_1688: "1688",
  manual: "手动"
} as const;

const statusLabel: Record<string, string> = {
  discovered: "发现",
  favorited: "已收藏",
  optimizing: "优化中",
  optimized: "已优化",
  ready_to_publish: "待发布",
  published: "已上架",
  promoted: "已推广"
};

function readDescriptionValue(description: string, label: string) {
  const line = description
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));

  return line?.split(":").slice(1).join(":").trim() || "";
}

function productStage(status: string, imageCount: number) {
  if (status === "promoted") return "已推广，回流成交中";
  if (status === "published") return "已上架 Ozon";
  if (status === "ready_to_publish") return "待发布上架";
  if (status === "optimized") return "已优化，待发布";
  if (status === "optimizing") return "AI 优化中";
  if (status === "favorited") return "已收藏，待处理";
  if (status === "discovered" && imageCount === 0) return "先补真实图片";
  if (status === "discovered") return "待优化";
  return "待处理";
}

export default async function ProductsPage() {
  const user = await requireApprovedUser();
  const productsRaw = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  const products = [...productsRaw].sort((a, b) => {
    const aImages = imageList(a.images).length;
    const bImages = imageList(b.images).length;
    const aOffer = readDescriptionValue(a.description, "Offer ID");
    const bOffer = readDescriptionValue(b.description, "Offer ID");
    const aProductId = readDescriptionValue(a.description, "Ozon Product ID");
    const bProductId = readDescriptionValue(b.description, "Ozon Product ID");
    const score = (product: typeof a, imageCount: number, offerId: string, productId: string) =>
      (imageCount > 0 ? 100 : 0) +
      (product.source === "ozon" || product.source === "ozon_market" ? 35 : 0) +
      (offerId ? 18 : 0) +
      (productId ? 18 : 0) +
      (product.status === "discovered" ? 4 : 0);
    const scoreDiff = score(b, bImages, bOffer, bProductId) - score(a, aImages, aOffer, aProductId);
    if (scoreDiff !== 0) return scoreDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  const total = products.length;
  const ozonCount = products.filter((product) => product.source === "ozon" || product.source === "ozon_market").length;
  const imageReadyCount = products.filter((product) => imageList(product.images).length > 0).length;
  const draftCount = products.filter((product) => product.status === "discovered").length;

  return (
    <AppShell title="商品池" eyebrow="真实货盘" user={user}>
      <section className="product-pool-console">
        <div>
          <p className="section-kicker">商品池</p>
          <h3>选品进入后，先看可操作信号。</h3>
        </div>
        <div className="pool-summary-strip">
          <div>
            <span>全部</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>Ozon</span>
            <strong>{ozonCount}</strong>
          </div>
          <div>
            <span>有图</span>
            <strong>{imageReadyCount}</strong>
          </div>
          <div>
            <span>待处理</span>
            <strong>{draftCount}</strong>
          </div>
        </div>
      </section>

      <section className="pool-action-bar">
        <div>
          <strong>优先处理：</strong>
          <span>有真实图、有价格、有 Offer ID 的 Ozon 商品。无图商品不会补假图，先回到调研或采集源补真实链接。</span>
        </div>
        <div className="pool-action-links">
          <Link href="/research/ozon">Ozon 调研</Link>
          <Link href="/collector">1688 采集</Link>
        </div>
      </section>

      <div className="product-pool-layout">
        <section className="pool-product-list">
          {products.length === 0 && <p className="pool-empty">暂无商品，先从 Ozon 调研或 1688 采集加入一个真实来源商品。</p>}
          {products.map((product) => {
            const images = imageList(product.images);
            const offerId = readDescriptionValue(product.description, "Offer ID");
            const ozonProductId = readDescriptionValue(product.description, "Ozon Product ID");
            const currency = readDescriptionValue(product.description, "Currency") || "CNY";
            const imageSource = readDescriptionValue(product.description, "Image source");
            const rating = readDescriptionValue(product.description, "Rating");
            const reviews = readDescriptionValue(product.description, "Reviews");
            const stage = productStage(product.status, images.length);

            return (
              <article key={product.id} className="pool-product-row">
                <Link href={`/products/${product.id}`} className="pool-row-image" aria-label={`编辑 ${product.title}`}>
                  <ReliableProductImage images={images} alt={product.title} className="h-full w-full object-contain" emptyLabel="无真实图" />
                  <span>{images.length ? `${images.length} 图` : "缺图"}</span>
                </Link>

                <div className="pool-row-main">
                  <div className="pool-row-title-line">
                    <span className={`pool-source source-${product.source}`}>{sourceLabel[product.source]}</span>
                    <Link href={`/products/${product.id}`} className="pool-row-title">
                      {product.title}
                    </Link>
                  </div>

                  <div className="pool-row-meta">
                    <span>Offer: {offerId || "未返回"}</span>
                    <span>Product: {ozonProductId || "手动/待同步"}</span>
                    <span>{imageSource ? "真实图源" : "图源待确认"}</span>
                  </div>
                  {(rating || reviews) && (
                    <div className="pool-row-meta">
                      {rating && <span>AI评分 {rating}</span>}
                      {reviews && <span>销量代理 {reviews} 评论</span>}
                    </div>
                  )}
                </div>

                <div className="pool-row-price">
                  <span>价格</span>
                  <strong>{Number(product.price).toFixed(2)}</strong>
                  <small>{currency}</small>
                </div>

                <div className="pool-row-state">
                  <span className="status-chip">{statusLabel[product.status]}</span>
                  <small>{stage}</small>
                </div>

                <Link href={`/products/${product.id}`} className="pool-row-action">
                  编辑
                </Link>
              </article>
            );
          })}
        </section>

        <form action={createProduct} className="pool-quick-create">
          <div>
            <p className="section-kicker">快速补录</p>
            <h3>手动商品</h3>
          </div>
          <p>主流程建议从调研/采集加入；这里用于临时录入已确认的真实链接。</p>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">来源</span>
              <select className="field" name="source" defaultValue="manual">
                <option value="manual">manual</option>
                <option value="ozon">ozon</option>
                <option value="ozon_market">ozon_market</option>
                <option value="source_1688">1688</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品标题</span>
              <input className="field" name="title" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">商品描述</span>
              <textarea className="field min-h-20" name="description" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">价格</span>
              <input className="field" name="price" type="number" min="0" step="0.01" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">图片 URL，每行一个</span>
              <textarea className="field min-h-20" name="images" />
              <span className="mt-2 block text-xs leading-5 text-steel">
                1688/Ozon 商品图必须来自真实商品链接或平台 API；没有真实图时请留空，系统不会补替代图。
              </span>
            </label>
          </div>
          <button className="btn-primary w-full">保存到商品池</button>
        </form>
      </div>
    </AppShell>
  );
}
