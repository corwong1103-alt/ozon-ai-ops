export interface OzonMarketProduct {
  source: "ozon_market";
  externalId: string;
  title: string;
  description?: string;
  price?: number;
  oldPrice?: number;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  imageUrl?: string;
  images?: string[];
  productUrl?: string;
  category?: string;
}

export type OzonMarketUiProduct = OzonMarketProduct & {
  productId: string;
  name: string;
  currency: string;
  images: string[];
  sourceUrl?: string;
  salesRank?: number;
  sellerName?: string;
};

function stringFrom(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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

function imageUrlsFrom(record: Record<string, unknown>) {
  const images: string[] = [];
  for (const key of [
    "images",
    "image",
    "imageUrl",
    "mainImage",
    "primaryImage",
    "primary_image",
    "photo",
    "photos",
    "picture",
    "pictures",
    "thumbnail",
    "media",
    "coverImageUrl",
    "coverImage"
  ]) {
    collectImageUrls(record[key], images);
  }
  return Array.from(new Set(images));
}

function nestedName(value: unknown) {
  if (typeof value === "string") return stringFrom(value);
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return stringFrom(record.name || record.title || record.sellerName);
}

function nestedNumber(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const parsed = numberFrom(record[key]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function numberAtPath(value: unknown, path: string) {
  const found = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
  return numberFrom(found);
}

function findPriceDeep(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  const direct = entries.find(([key]) => {
    const normalized = key.toLowerCase();
    return normalized.includes("price") && !normalized.includes("original") && !normalized.includes("old");
  });
  if (direct) {
    const parsed = numberFrom(direct[1]);
    if (parsed !== undefined) return parsed;
  }
  for (const [, item] of entries) {
    const nested = findPriceDeep(item);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function categoryFrom(value: unknown) {
  if (!Array.isArray(value)) return "";
  const names = value
    .map((item) => item && typeof item === "object" ? stringFrom((item as Record<string, unknown>).name) : "")
    .filter(Boolean);
  return names.at(-1) || "";
}

function externalIdFrom(record: Record<string, unknown>, productUrl: string, index: number) {
  const direct = stringFrom(record.externalId || record.productId || record.product_id || record.id || record.sku || record.offerId);
  if (direct) return direct;
  const fromUrl = productUrl.match(/-(\d+)\/?$/)?.[1] || productUrl.match(/\/product\/[^/]*?(\d+)(?:\/|\?|$)/)?.[1];
  return fromUrl || `ozon_market_${index + 1}`;
}

export function normalizeApifyOzonProduct(item: unknown, index: number): OzonMarketProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const title = stringFrom(record.title || record.name || record.productName || record.product_name);
  if (!title) return null;

  const images = imageUrlsFrom(record);
  const productUrl = stringFrom(record.url || record.productUrl || record.product_url || record.productLink || record.link || record.sourceUrl);
  const seller = nestedName(record.seller) || stringFrom(record.sellerName || record.seller_name || record.shopName);
  const description = stringFrom(record.description || record.descriptionText);
  const category = categoryFrom(record.breadcrumbs) || nestedName(record.category) || stringFrom(record.category || record.categoryName || record.category_name);
  const price = numberFrom(record.cardPriceDecimal)
    ?? numberFrom(record.priceDecimal)
    ?? numberAtPath(record.price, "cardPrice.price")
    ?? nestedNumber(record.price, ["cardPrice", "price", "originalPrice"])
    ?? numberFrom(record.price || record.currentPrice || record.current_price || record.salePrice || record.sale_price || record.cardPrice)
    ?? findPriceDeep(record);
  const oldPrice = numberFrom(record.originalPriceDecimal)
    ?? numberFrom(record.oldPrice || record.old_price || record.originalPrice || record.original_price);
  const rating = nestedNumber(record.rating, ["totalScore", "score", "value"])
    ?? numberFrom(record.rating || record.ratingValue || record.rating_value);
  const reviewCount = nestedNumber(record.rating, ["reviewsCount", "reviewCount"])
    ?? numberFrom(record.reviewCount || record.review_count || record.reviewsCount || record.reviews_count || record.reviews);

  return {
    source: "ozon_market",
    externalId: externalIdFrom(record, productUrl, index),
    title,
    ...(description ? { description } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(oldPrice !== undefined ? { oldPrice } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    ...(seller ? { seller } : {}),
    ...(images[0] ? { imageUrl: images[0], images } : {}),
    ...(productUrl ? { productUrl } : {}),
    ...(category ? { category } : {})
  };
}

export function toOzonMarketUiProduct(product: OzonMarketProduct, index: number): OzonMarketUiProduct {
  return {
    ...product,
    productId: product.externalId,
    name: product.title,
    currency: "RUB",
    images: product.images || (product.imageUrl ? [product.imageUrl] : []),
    sourceUrl: product.productUrl,
    salesRank: index + 1,
    sellerName: product.seller
  };
}
