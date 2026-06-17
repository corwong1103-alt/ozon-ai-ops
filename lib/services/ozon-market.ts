import "server-only";

import type { Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { readPublicConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 20;

export type OzonMarketCategory = {
  id: string;
  label: string;
  ruLabel: string;
  keywords: string[];
};

export type OzonMarketProduct = {
  productId: string;
  name: string;
  price: number;
  currency: string;
  images: string[];
  sourceUrl?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  salesRank?: number;
  sellerName?: string;
};

export type OzonMarketSearchResult = {
  mode: "configured" | "unconfigured" | "error";
  sourceName: string;
  message: string;
  products: OzonMarketProduct[];
};

export const ozonMarketCategories: OzonMarketCategory[] = [
  { id: "", label: "全部类目", ruLabel: "Все категории", keywords: [] },
  { id: "beauty_hair", label: "美妆个护 / 头发护理", ruLabel: "Красота / Уход за волосами", keywords: ["волос", "шампунь", "сыворотка", "маска для волос", "生发", "护发"] },
  { id: "beauty_skin", label: "美妆个护 / 面部护理", ruLabel: "Красота / Уход за лицом", keywords: ["кожа", "лицо", "крем", "сыворотка для лица", "护肤", "面霜"] },
  { id: "home_kitchen", label: "家居厨房", ruLabel: "Дом и кухня", keywords: ["дом", "кухня", "посуда", "органайзер", "家居", "厨房"] },
  { id: "electronics", label: "数码电子", ruLabel: "Электроника", keywords: ["смартфон", "зарядка", "usb", "наушники", "数码", "电子"] },
  { id: "kids", label: "母婴儿童", ruLabel: "Детские товары", keywords: ["детский", "ребенок", "игрушка", "baby", "母婴", "儿童"] },
  { id: "auto", label: "汽车用品", ruLabel: "Автотовары", keywords: ["авто", "машина", "держатель", "автомобильный", "汽车", "车载"] },
  { id: "fashion", label: "服饰配件", ruLabel: "Одежда и аксессуары", keywords: ["одежда", "обувь", "сумка", "аксессуар", "服饰", "鞋"] },
  { id: "sports", label: "运动户外", ruLabel: "Спорт и отдых", keywords: ["спорт", "фитнес", "туризм", "тренировка", "运动", "户外"] },
  { id: "pet", label: "宠物用品", ruLabel: "Товары для животных", keywords: ["животные", "кошка", "собака", "корм", "宠物"] },
  { id: "tools", label: "五金工具", ruLabel: "Инструменты", keywords: ["инструмент", "дрель", "ремонт", "набор инструментов", "工具"] },
  { id: "health", label: "健康护理", ruLabel: "Здоровье", keywords: ["здоровье", "массажер", "витамины", "уход", "健康", "护理"] }
];

function categoryKeyword(categoryId: string) {
  return ozonMarketCategories.find((item) => item.id === categoryId)?.keywords[0] || "";
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberOrZero(value: unknown) {
  return numberOrUndefined(value) ?? 0;
}

function stringFrom(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function imageUrlsFrom(item: Record<string, unknown>) {
  const images: string[] = [];
  for (const key of ["images", "image", "imageUrl", "primaryImage", "primary_image", "photo", "photos", "picture", "pictures", "thumbnail"]) {
    collectImageUrls(item[key], images);
  }
  return Array.from(new Set(images));
}

function valueAtPath(value: unknown, path: string) {
  if (!path.trim()) return undefined;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function firstArrayFromPayload(payload: unknown, configuredPath?: string) {
  const paths = [
    configuredPath,
    "items",
    "products",
    "results",
    "data.items",
    "data.products",
    "data.results",
    "result.items",
    "result.products",
    "result.results"
  ].filter(Boolean) as string[];

  for (const path of paths) {
    const value = valueAtPath(payload, path);
    if (Array.isArray(value)) return value;
  }

  return Array.isArray(payload) ? payload : [];
}

function normalizeMarketProduct(item: unknown, index: number): OzonMarketProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const productId = stringFrom(record.productId || record.product_id || record.id || record.sku || record.url, `market_${index + 1}`);
  const name = stringFrom(record.name || record.title || record.productName || record.product_name);
  if (!name) return null;

  return {
    productId,
    name,
    price: numberOrZero(record.price || record.salePrice || record.sale_price || record.currentPrice || record.current_price),
    currency: stringFrom(record.currency || record.currencyCode || record.currency_code, "RUB"),
    images: imageUrlsFrom(record),
    sourceUrl: stringFrom(record.url || record.sourceUrl || record.source_url || record.productUrl || record.product_url) || undefined,
    category: stringFrom(record.category || record.categoryName || record.category_name) || undefined,
    rating: numberOrUndefined(record.rating),
    reviewCount: numberOrUndefined(record.reviewCount || record.review_count || record.reviews),
    salesRank: numberOrUndefined(record.salesRank || record.sales_rank || record.rank) ?? index + 1,
    sellerName: stringFrom(record.sellerName || record.seller_name || record.seller) || undefined
  };
}

function joinUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

async function getMarketIntegration(userId: string) {
  const own = await prisma.apiIntegration.findUnique({
    where: { userId_provider: { userId, provider: "ozon_market" } }
  });
  if (own?.secretEncrypted || readPublicConfig(own?.publicConfig).apiBaseUrl) return own;

  return prisma.apiIntegration.findFirst({
    where: {
      provider: "ozon_market",
      user: { role: "admin" }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function searchOzonMarketProducts(input: {
  userId: string;
  keyword?: string;
  categoryId?: string;
  limit?: number;
}): Promise<OzonMarketSearchResult> {
  const integration = await getMarketIntegration(input.userId);
  const publicConfig = readPublicConfig(integration?.publicConfig);
  const apiBaseUrl = publicConfig.apiBaseUrl?.trim();
  const searchPath = publicConfig.searchPath?.trim() || "/search";
  const sourceName = integration?.accountLabel || "Ozon 市场数据源";

  if (!apiBaseUrl) {
    return {
      mode: "unconfigured",
      sourceName,
      message: "尚未接入 Ozon 全站市场数据源。当前不能真实搜索全 Ozon，也不能生成热销 Top10-20。",
      products: []
    };
  }

  try {
    const keyword = input.keyword?.trim() || categoryKeyword(input.categoryId || "");
    const url = new URL(joinUrl(apiBaseUrl, searchPath));
    url.searchParams.set(publicConfig.queryParam || "q", keyword);
    if (input.categoryId) url.searchParams.set(publicConfig.categoryParam || "category", input.categoryId);
    url.searchParams.set(publicConfig.limitParam || "limit", String(input.limit || DEFAULT_LIMIT));

    const headers: Record<string, string> = { Accept: "application/json" };
    const secret = integration?.secretEncrypted ? decryptSecret(integration.secretEncrypted) : "";
    if (secret) {
      const headerName = publicConfig.authHeader || "Authorization";
      const scheme = publicConfig.authScheme || "Bearer";
      headers[headerName] = scheme ? `${scheme} ${secret}` : secret;
    }

    const response = await fetch(url, { headers, cache: "no-store" });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as Prisma.JsonValue : [];

    if (!response.ok) {
      throw new Error(text.slice(0, 220) || `HTTP ${response.status}`);
    }

    const items = firstArrayFromPayload(payload, publicConfig.resultPath)
      .map(normalizeMarketProduct)
      .filter((item): item is OzonMarketProduct => Boolean(item))
      .slice(0, input.limit || DEFAULT_LIMIT);

    return {
      mode: "configured",
      sourceName,
      message: items.length
        ? `已从真实市场数据源读取 ${items.length} 个 Ozon 商品。`
        : "市场数据源已连接，但当前关键词/类目没有返回商品。",
      products: items
    };
  } catch (error) {
    return {
      mode: "error",
      sourceName,
      message: error instanceof Error ? `Ozon 市场数据源请求失败：${error.message}` : "Ozon 市场数据源请求失败。",
      products: []
    };
  }
}
