import "server-only";

import { runActor, getActorId, ApifyNotConfiguredError, type ApifyRuntimeConfig } from "@/lib/apify/client";
import { getApifyRuntimeConfig } from "@/lib/apify/client";

/**
 * 1688 商品采集（基于 Apify Actor devcake/1688-com-products-scraper）。
 *
 * 与 Ozon 不同，1688 直接以中文关键词搜索，不做关键词映射。
 */

export const DEFAULT_1688_ACTOR_ID = "devcake/1688-com-products-scraper";

export type Source1688Product = {
  id: string;
  source: "1688";
  title: string;
  image: string;
  images: string[];
  price: number;
  supplier: string;
  supplierLevel: string;
  sales: number;
  rating: number;
  productUrl: string;
  raw: Record<string, unknown>;
};

// ── 安全取值工具（缺字段永不崩溃）──
function stringFrom(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const primary = value.split("(")[0] || value;
  const normalized = primary
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nestedString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = stringFrom(record[key]);
    if (found) return found;
  }
  return "";
}

function collectImageUrls(value: unknown, target: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) target.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, target));
    return;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectImageUrls(item, target));
  }
}

function imageUrlsFrom(record: Record<string, unknown>): string[] {
  const images: string[] = [];
  for (const key of [
    "images",
    "image",
    "imageUrl",
    "image_url",
    "mainImage",
    "primaryImage",
    "primary_image",
    "photos",
    "photo",
    "picture",
    "pictures",
    "thumbnail",
    "media"
  ]) {
    collectImageUrls(record[key], images);
  }
  return Array.from(new Set(images));
}

function supplierFrom(record: Record<string, unknown>): string {
  // 1688 常见字段：supplier / supplierName / shopName / company / seller / winPortUrl
  return (
    nestedString(record.supplier, ["name", "title", "shopName", "company"]) ||
    stringFrom(record.supplierName || record.shopName || record.shop_name || record.company || record.seller || record.supplierName || record.sellerName)
  );
}

function supplierLevelFrom(record: Record<string, unknown>): string {
  return (
    nestedString(record.supplier, ["level", "levelText", "star", "grade"]) ||
    stringFrom(record.supplierLevel || record.shopLevel || record.level || record.grade)
  );
}

function salesFrom(record: Record<string, unknown>): number {
  // 1688 销量字段：sale / sales / soldCount / tradeQuantity / monthSold
  const keys = ["sale", "sales", "soldCount", "sold_count", "tradeQuantity", "trade_quantity", "monthSold", "month_sold", "quantitySold", "orderCount", "order_count"];
  for (const key of keys) {
    const parsed = numberFrom(record[key]);
    if (parsed !== undefined) return parsed;
  }
  return 0;
}

function ratingFrom(record: Record<string, unknown>): number {
  const keys = ["rating", "score", "star", "stars", "ratingValue", "composite_score"];
  for (const key of keys) {
    const parsed = numberFrom(record[key]);
    if (parsed !== undefined) return parsed;
  }
  return 0;
}

function priceFrom(record: Record<string, unknown>): number {
  const priceInteger = numberFrom(record.price_integer);
  if (priceInteger !== undefined) {
    const decimalText = stringFrom(record.price_decimal).replace(/^\./, "");
    const decimal = decimalText ? Number(`0.${decimalText.replace(/[^\d]/g, "")}`) : 0;
    if (Number.isFinite(decimal)) return priceInteger + decimal;
  }

  // 1688 价格区间取最低：price / priceRange / priceInfo.priceRanges[0].price
  const directKeys = ["price", "priceInfo", "salePrice", "sale_price", "unitPrice", "priceRanges"];
  for (const key of directKeys) {
    const parsed = numberFrom(record[key]);
    if (parsed !== undefined) return parsed;
  }
  // 嵌套 priceInfo
  const priceInfo = record.priceInfo;
  if (priceInfo && typeof priceInfo === "object") {
    const pi = priceInfo as Record<string, unknown>;
    const ranges = pi.priceRanges;
    if (Array.isArray(ranges) && ranges.length > 0) {
      const first = ranges[0];
      if (first && typeof first === "object") {
        const parsed = numberFrom((first as Record<string,unknown>).price);
        if (parsed !== undefined) return parsed;
      }
    }
    const parsed = numberFrom(pi.price);
    if (parsed !== undefined) return parsed;
  }
  const quantityPrices = record.quantity_prices;
  if (Array.isArray(quantityPrices) && quantityPrices.length > 0) {
    const first = quantityPrices[0];
    if (first && typeof first === "object") {
      const parsed = numberFrom((first as Record<string, unknown>).price);
      if (parsed !== undefined) return parsed;
    }
  }
  return 0;
}

function idFrom(record: Record<string, unknown>, productUrl: string, index: number): string {
  const direct = stringFrom(record.id || record.productId || record.product_id || record.offerId || record.offer_id || record.skuId);
  if (direct) return direct;
  // 从 1688 商品 URL 提取 offer id：detail.1688.com/offer/123456.html
  const fromUrl = productUrl.match(/offer\/(\d+)/i)?.[1] || productUrl.match(/(\d{6,})/)?.[1];
  return fromUrl || `1688_${index + 1}`;
}

function productUrlFrom(record: Record<string, unknown>): string {
  return stringFrom(
    record.detailUrl || record.detail_url || record.productUrl ||
      record.product_url || record.link || record.url || record.offerUrl ||
      record.offer_url || record.sourceUrl || record.detail_url || record.detailUrl
  );
}

/**
 * 将 Apify 1688 Actor 单条输出归一化为内部结构。缺字段填默认值，永不崩溃。
 */
export function normalize1688Product(item: unknown, index: number): Source1688Product | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const title = stringFrom(record.title || record.subject || record.name || record.productName);
  if (!title) return null; // 无标题直接丢弃

  const images = imageUrlsFrom(record);
  const productUrl = productUrlFrom(record);

  return {
    id: idFrom(record, productUrl, index),
    source: "1688",
    title,
    image: images[0] || "",
    images,
    price: priceFrom(record),
    supplier: supplierFrom(record),
    supplierLevel: supplierLevelFrom(record),
    sales: salesFrom(record),
    rating: ratingFrom(record),
    productUrl,
    raw: record
  };
}

export function normalize1688Items(items: unknown[]): Source1688Product[] {
  return items
    .map(normalize1688Product)
    .filter((item): item is Source1688Product => Boolean(item));
}

/**
 * 搜索 1688 商品。Actor input 与 task spec 一致：
 *   { searchQueries: [keyword], maxProductsPerQuery: 50, sortBy: "best_selling" }
 */
export async function search1688Products(input: {
  userId?: string;
  keyword: string;
  maxProductsPerQuery?: number;
  timeoutMs?: number;
}): Promise<Source1688Product[]> {
  const keyword = input.keyword.trim();
  if (!keyword) return [];

  const userId = input.userId;
  const config: ApifyRuntimeConfig = await getApifyRuntimeConfig(userId, "source_1688");
  if (!config.configured) {
    throw new ApifyNotConfiguredError("当前账号未配置 1688 Apify Token，无法采集真实 1688 商品。");
  }
  const actorId = await getActorId(userId, "source_1688", "APIFY_1688_ACTOR_ID", DEFAULT_1688_ACTOR_ID);

  const actorInput = {
    queries: [keyword],
    searchQueries: [keyword],
    maxProductsPerQuery: input.maxProductsPerQuery ?? 50,
    maxProducts: input.maxProductsPerQuery ?? 50,
    sortBy: "best_selling"
  };

  const result = await runActor({
    userId,
    provider: "source_1688",
    actorId,
    input: actorInput,
    timeoutMs: input.timeoutMs ?? 60_000,
    logTag: "1688_search"
  });

  const products = normalize1688Items(result.items);
  console.info("[1688_search_result]", JSON.stringify({
    keyword,
    rawCount: result.items.length,
    normalizedCount: products.length,
    firstTitle: products[0]?.title || "",
    firstPrice: products[0]?.price ?? null,
    status: result.status,
    timedOut: result.timedOut,
    totalMs: result.totalMs
  }));

  return products;
}
