import "server-only";

import { createHmac } from "crypto";
import type { Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { readPublicConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

const DEFAULT_1688_OPENAPI_BASE_URL = "https://gw.open.1688.com/openapi";
const PRODUCT_GET_NAMESPACE = "com.alibaba.product";
const PRODUCT_GET_NAME = "alibaba.product.get";
const PRODUCT_GET_VERSION = "1";

export class Source1688ConfigError extends Error {
  code = "SOURCE_1688_NOT_CONFIGURED" as const;
  constructor(message = "1688 OpenAPI 未配置完整，请先填写 App Key、App Secret 和 Access Token。") {
    super(message);
    this.name = "Source1688ConfigError";
  }
}

export class Source1688OpenApiError extends Error {
  code = "SOURCE_1688_OPENAPI_ERROR" as const;
  constructor(message: string, public status?: number, public payload?: unknown) {
    super(message);
    this.name = "Source1688OpenApiError";
  }
}

export type Source1688Sku = {
  skuId: string;
  price: number;
  stock?: number;
  attributes: Record<string, string>;
};

export type Source1688CollectedProduct = {
  id: string;
  source: "1688";
  title: string;
  image: string;
  images: string[];
  sku: string;
  skus: Source1688Sku[];
  price: number;
  supplier: string;
  supplierLevel: string;
  sales: number;
  rating: number;
  productUrl: string;
  attributes: Array<{ key: string; value: string }>;
  raw: Record<string, unknown>;
};

function cleanString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberFrom(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const primary = value.split("(")[0] || value;
  const parsed = Number(primary.replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
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

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return undefined;
}

function arrayFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["data", "items", "list", "skuInfos", "attributes"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export function extract1688OfferId(urlOrId: string): string {
  const value = urlOrId.trim();
  if (/^\d{6,}$/.test(value)) return value;
  return (
    value.match(/offer\/(\d{6,})/i)?.[1] ||
    value.match(/[?&](?:offerId|offerid|productID|productId)=(\d{6,})/i)?.[1] ||
    value.match(/(\d{8,})/)?.[1] ||
    ""
  );
}

export function sign1688OpenApiRequest(path: string, params: Record<string, string>, appSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], path);
  return createHmac("sha1", appSecret).update(payload, "utf8").digest("hex").toUpperCase();
}

async function getSource1688Integration(userId: string | undefined) {
  const own = userId
    ? await prisma.apiIntegration.findUnique({ where: { userId_provider: { userId, provider: "source_1688" } } })
    : null;
  if (own?.secretEncrypted) return own;
  return prisma.apiIntegration.findFirst({
    where: { provider: "source_1688", user: { role: "admin" } },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getSource1688Config(userId?: string) {
  const integration = await getSource1688Integration(userId);
  if (!integration) throw new Source1688ConfigError();
  const publicConfig = readPublicConfig(integration.publicConfig);
  const appKey = publicConfig.appKey || "";
  const accessToken = publicConfig.accessToken || "";
  const refreshToken = publicConfig.refreshToken || "";
  const appSecret = integration.secretEncrypted ? decryptSecret(integration.secretEncrypted) : "";
  if (!appKey || !appSecret || !accessToken) throw new Source1688ConfigError();
  return {
    appKey,
    appSecret,
    accessToken,
    refreshToken,
    tokenSource: integration.userId === userId ? "seller" : "admin"
  };
}

function normalizeAttributes(value: unknown): Array<{ key: string; value: string }> {
  return arrayFrom(value)
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const key = cleanString(record.attributeName || record.name || record.key);
      const val = cleanString(record.value || record.attributeValue || record.valueName);
      return { key, value: val };
    })
    .filter((item) => item.key || item.value);
}

function normalizeSkus(value: unknown): Source1688Sku[] {
  return arrayFrom(value).map((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const attributes = normalizeAttributes(record.attributes || record.skuAttributes || record.saleAttributes)
      .reduce<Record<string, string>>((acc, item) => {
        if (item.key || item.value) acc[item.key || "属性" + (Object.keys(acc).length + 1)] = item.value;
        return acc;
      }, {});
    return {
      skuId: cleanString(record.skuId || record.skuID || record.id) || "sku_" + (index + 1),
      price: numberFrom(record.price || record.retailPrice || record.discountPrice),
      stock: numberFrom(record.amountOnSale || record.stock || record.canBookCount) || undefined,
      attributes
    };
  });
}

function normalizeOpenApiPayload(payload: unknown, fallbackUrl: string, offerId: string): Source1688CollectedProduct {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const productInfo = firstRecord(root.productInfo) || firstRecord(root.result) || firstRecord(root.data) || root;
  const images: string[] = [];
  collectImageUrls(productInfo.productImage || productInfo.image || productInfo.images || productInfo.imageList, images);
  const dedupedImages = Array.from(new Set(images));
  const saleInfo = productInfo.saleInfo && typeof productInfo.saleInfo === "object" ? productInfo.saleInfo as Record<string, unknown> : {};
  const supplierInfo = productInfo.supplierInfo && typeof productInfo.supplierInfo === "object" ? productInfo.supplierInfo as Record<string, unknown> : {};
  const skus = normalizeSkus(productInfo.skuInfos || productInfo.skuInfo || productInfo.skus);
  const attributes = normalizeAttributes(productInfo.attributes || productInfo.productAttributes || productInfo.productAttribute);
  const priceRange = firstRecord(saleInfo.priceRangeList || saleInfo.priceRange);
  const price = skus.find((sku) => sku.price > 0)?.price || numberFrom(saleInfo.price || priceRange?.price || productInfo.price);

  return {
    id: cleanString(productInfo.productID || productInfo.productId || productInfo.offerId || offerId),
    source: "1688",
    title: cleanString(productInfo.subject || productInfo.title || productInfo.name),
    image: dedupedImages[0] || "",
    images: dedupedImages,
    sku: skus[0]?.skuId || cleanString(productInfo.skuId || productInfo.skuID),
    skus,
    price,
    supplier: cleanString(supplierInfo.companyName || supplierInfo.name || productInfo.supplierName || productInfo.companyName),
    supplierLevel: cleanString(supplierInfo.supplierLevel || supplierInfo.level),
    sales: numberFrom(saleInfo.amountOnSale || productInfo.saleQuantity || productInfo.monthSold),
    rating: numberFrom(productInfo.qualityStar || productInfo.rating),
    productUrl: cleanString(productInfo.detailUrl || productInfo.productUrl || fallbackUrl),
    attributes,
    raw: root
  };
}

export async function collect1688ProductByLink(input: {
  userId?: string;
  productUrl: string;
}): Promise<Source1688CollectedProduct> {
  const offerId = extract1688OfferId(input.productUrl);
  if (!offerId) throw new Source1688OpenApiError("无法从 1688 商品链接中识别 offerId。");
  const config = await getSource1688Config(input.userId);
  const path = "/param2/" + PRODUCT_GET_VERSION + "/" + PRODUCT_GET_NAMESPACE + "/" + PRODUCT_GET_NAME + "/" + config.appKey;
  const params: Record<string, string> = {
    access_token: config.accessToken,
    productID: offerId,
    webSite: "1688"
  };
  const signature = sign1688OpenApiRequest(path, params, config.appSecret);
  const body = new URLSearchParams({ ...params, _aop_signature: signature });
  const response = await fetch(DEFAULT_1688_OPENAPI_BASE_URL + path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    cache: "no-store"
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Source1688OpenApiError(text.slice(0, 500) || "1688 OpenAPI HTTP " + response.status, response.status, payload);
  }
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (record.errorCode || record.error_message || record.errorMessage) {
    throw new Source1688OpenApiError(
      cleanString(record.error_message || record.errorMessage || record.errorCode) || "1688 OpenAPI 返回错误。",
      response.status,
      payload
    );
  }
  const product = normalizeOpenApiPayload(payload, input.productUrl, offerId);
  if (!product.title || !product.image || !product.productUrl) {
    throw new Source1688OpenApiError("1688 OpenAPI 返回数据缺少标题、主图或商品链接。", response.status, payload);
  }
  return product;
}

export function source1688RawData(product: Source1688CollectedProduct): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    ...product.raw,
    normalized: {
      sku: product.sku,
      skus: product.skus,
      attributes: product.attributes
    }
  })) as Prisma.InputJsonValue;
}
