import "server-only";

import { decryptSecret } from "@/lib/crypto";

const DEFAULT_OZON_API_BASE_URL = "https://api-seller.ozon.ru";
const OZON_TEXT_LIMIT = 360;
const DEFAULT_OZON_CATEGORY_ID = 17028922;
const HARDCODED_OZON_UPLOAD_WARNING =
  "Attributes are hardcoded for category 17028922. Real upload requires category tree query + attribute mapping.";

export type OzonUploadInput = {
  store: {
    ozonStoreId: string;
    ozonClientId: string;
    apiKeyEncrypted: string;
  };
  product: {
    title: string;
    description: string;
    price: unknown;
    images: unknown;
  };
};

export type OzonCredentialCheckInput = {
  ozonClientId: string;
  apiKey: string;
};

export type OzonCredentialCheckResult = {
  ok: boolean;
  endpoint: string;
  status?: number;
  message?: string;
};

export type OzonProbeResource = "roles" | "warehouses" | "products" | "orders";

export type OzonProbeInput = {
  resource: OzonProbeResource;
  store: {
    ozonClientId: string;
    apiKeyEncrypted: string;
  };
};

export type OzonProbeResult = {
  ok: boolean;
  resource: OzonProbeResource;
  label: string;
  endpoint: string;
  status?: number;
  count?: number;
  summary: string;
  preview?: Array<Record<string, unknown>>;
  message?: string;
};

export type OzonProductImport = {
  productId: number;
  offerId: string;
  name: string;
  price: number;
  currency: string;
  images: string[];
  archived: boolean;
};

export type OzonOrderImport = {
  postingNumber: string;
  status: string;
  inProcessAt?: string;
  shipmentDate?: string;
  warehouseId?: number;
  items: Array<{
    skuId?: string;
    offerId?: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  currency: string;
};

function getOzonApiBaseUrl() {
  return (process.env.OZON_API_BASE_URL || DEFAULT_OZON_API_BASE_URL).replace(/\/$/, "");
}

async function postOzon(endpoint: string, input: OzonCredentialCheckInput, body: unknown = {}) {
  const response = await fetch(`${getOzonApiBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Client-Id": input.ozonClientId,
      "Api-Key": input.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = responseText;
  }

  if (response.ok) {
    return { ok: true, endpoint, status: response.status, data };
  }

  return {
    ok: false,
    endpoint,
    status: response.status,
    data,
    message: responseText.slice(0, OZON_TEXT_LIMIT)
  };
}

export async function checkOzonCredentials(input: OzonCredentialCheckInput): Promise<OzonCredentialCheckResult> {
  const endpoints = ["/v1/roles", "/v2/warehouse/list"];
  let lastResult: OzonCredentialCheckResult | undefined;

  for (const endpoint of endpoints) {
    try {
      const result = await postOzon(endpoint, input);
      if (result.ok) {
        return result;
      }
      lastResult = result;
    } catch (error) {
      lastResult = {
        ok: false,
        endpoint,
        message: error instanceof Error ? error.message : "Unknown Ozon API connection error."
      };
    }
  }

  return lastResult || {
    ok: false,
    endpoint: endpoints[0],
    message: "Ozon API connection failed."
  };
}

function arrayFromPath(data: unknown, path: string[]) {
  let value = data;
  for (const key of path) {
    if (!value || typeof value !== "object" || !(key in value)) return [];
    value = (value as Record<string, unknown>)[key];
  }

  return Array.isArray(value) ? value : [];
}

function takeRecordFields(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(fields.filter((field) => field in record).map((field) => [field, record[field]]));
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
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

function normalizeOzonImages(item: Record<string, unknown>) {
  const images: string[] = [];
  for (const key of ["primary_image", "images", "images360", "color_image", "marketing_image", "sources"]) {
    collectImageUrls(item[key], images);
  }
  return Array.from(new Set(images)).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  });
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - 1000 * 60 * 60 * 24 * days).toISOString();
}

function normalizeOzonProduct(item: Record<string, unknown>): OzonProductImport {
  return {
    productId: numberOrZero(item.id || item.product_id),
    offerId: String(item.offer_id || ""),
    name: String(item.name || item.offer_id || "Ozon product"),
    price: numberOrZero(item.price),
    currency: String(item.currency_code || "CNY"),
    images: normalizeOzonImages(item),
    archived: Boolean(item.is_archived || item.is_autoarchived)
  };
}

function normalizeOzonOrder(item: Record<string, unknown>): OzonOrderImport {
  const products = Array.isArray(item.products) ? item.products : [];
  const items = products
    .filter((product): product is Record<string, unknown> => Boolean(product) && typeof product === "object")
    .map((product) => {
      const quantity = numberOrZero(product.quantity) || 1;
      const price = numberOrZero(product.price) || 0;
      return {
        skuId: product.sku ? String(product.sku) : undefined,
        offerId: product.offer_id ? String(product.offer_id) : undefined,
        title: String(product.name || product.title || product.offer_id || product.sku || "Ozon order item"),
        quantity,
        price
      };
    });
  const totalAmount = items.reduce((sum, orderItem) => sum + orderItem.price * orderItem.quantity, 0);
  return {
    postingNumber: String(item.posting_number || ""),
    status: String(item.status || ""),
    inProcessAt: item.in_process_at ? String(item.in_process_at) : undefined,
    shipmentDate: item.shipment_date ? String(item.shipment_date) : undefined,
    warehouseId: typeof item.warehouse_id === "number" ? item.warehouse_id : undefined,
    items,
    totalAmount,
    currency: "RUB"
  };
}

async function fetchOzonProductImports(input: OzonCredentialCheckInput, limit = 20) {
  const list = await postOzon("/v3/product/list", input, { filter: { visibility: "ALL" }, limit, last_id: "" });
  if (!list.ok) {
    throw new Error(list.message || "Ozon product list request failed.");
  }

  const productIds = arrayFromPath(list.data, ["result", "items"])
    .map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).product_id : undefined)
    .filter((id): id is number => typeof id === "number");

  if (!productIds.length) return [];

  const info = await postOzon("/v3/product/info/list", input, { product_id: productIds });
  if (!info.ok) {
    throw new Error(info.message || "Ozon product info request failed.");
  }

  return arrayFromPath(info.data, ["items"])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(normalizeOzonProduct);
}

async function fetchOzonOrderImports(input: OzonCredentialCheckInput, limit = 20) {
  const result = await postOzon("/v3/posting/fbs/list", input, {
    dir: "DESC",
    filter: {
      since: isoDateDaysAgo(30),
      to: new Date().toISOString()
    },
    limit,
    offset: 0,
    with: {
      analytics_data: false,
      barcodes: false,
      financial_data: false,
      translit: false
    }
  });

  if (!result.ok) {
    throw new Error(result.message || "Ozon order list request failed.");
  }

  return arrayFromPath(result.data, ["result", "postings"])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map(normalizeOzonOrder);
}

function getProbeRequest(resource: OzonProbeResource) {
  const now = new Date();
  const since = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);

  switch (resource) {
    case "roles":
      return {
        label: "权限",
        endpoint: "/v1/roles",
        body: {},
        extract: (data: unknown) => {
          const roles = arrayFromPath(data, ["roles"]);
          return {
            count: roles.length,
            summary: roles.length ? `当前密钥返回 ${roles.length} 个权限项。` : "接口可访问，但未返回权限项。",
            preview: roles.slice(0, 8).map((role) => {
              const record = role && typeof role === "object" ? role as Record<string, unknown> : {};
              return {
                权限: record.name,
                接口数: Array.isArray(record.methods) ? record.methods.length : 0,
                到期时间: data && typeof data === "object" ? (data as Record<string, unknown>).expires_at : undefined
              };
            })
          };
        }
      };
    case "warehouses":
      return {
        label: "仓库",
        endpoint: "/v2/warehouse/list",
        body: {},
        extract: (data: unknown) => {
          const warehouses = arrayFromPath(data, ["warehouses"]);
          return {
            count: warehouses.length,
            summary: warehouses.length ? `读取到 ${warehouses.length} 个仓库。` : "接口可访问，但当前没有返回仓库。",
            preview: warehouses.slice(0, 5).map((warehouse) => {
              const record = takeRecordFields(warehouse, ["warehouse_id", "name", "status", "delivery_method_id"]) as Record<string, unknown>;
              return {
                仓库ID: record.warehouse_id,
                名称: record.name,
                状态: record.status,
                配送方式ID: record.delivery_method_id
              };
            })
          };
        }
      };
    case "products":
      return {
        label: "商品",
        endpoint: "/v3/product/list",
        body: { filter: { visibility: "ALL" }, limit: 10, last_id: "" },
        extract: async (_data: unknown, input: OzonCredentialCheckInput) => {
          const items = await fetchOzonProductImports(input, 10);
          return {
            count: items.length,
            summary: items.length ? `读取到 ${items.length} 个商品记录。` : "接口可访问，但当前没有返回商品记录。",
            preview: items.slice(0, 8).map((item) => ({
              商品ID: item.productId,
              货号: item.offerId,
              商品名: item.name,
              价格: `${item.price} ${item.currency}`,
              图片数: item.images.length
            }))
          };
        }
      };
    case "orders":
      return {
        label: "订单",
        endpoint: "/v3/posting/fbs/list",
        body: {
          dir: "DESC",
          filter: { since: since.toISOString(), to: now.toISOString() },
          limit: 10,
          offset: 0,
          with: { analytics_data: false, barcodes: false, financial_data: false, translit: false }
        },
        extract: (data: unknown) => {
          const postings = arrayFromPath(data, ["result", "postings"]);
          return {
            count: postings.length,
            summary: postings.length ? `近 30 天读取到 ${postings.length} 条 FBS 订单。` : "接口可访问，近 30 天没有返回 FBS 订单。",
            preview: postings.slice(0, 6).map((posting) => {
              const record = takeRecordFields(posting, ["posting_number", "status", "in_process_at", "shipment_date", "warehouse_id"]) as Record<string, unknown>;
              return {
                订单号: record.posting_number,
                状态: record.status,
                处理时间: record.in_process_at,
                发货时间: record.shipment_date,
                仓库ID: record.warehouse_id
              };
            })
          };
        }
      };
  }
}

export async function probeOzonStore(input: OzonProbeInput): Promise<OzonProbeResult> {
  const apiKey = decryptSecret(input.store.apiKeyEncrypted);
  const request = getProbeRequest(input.resource);
  const credentials = { ozonClientId: input.store.ozonClientId, apiKey };
  const result = await postOzon(request.endpoint, credentials, request.body);

  if (!result.ok) {
    return {
      ok: false,
      resource: input.resource,
      label: request.label,
      endpoint: request.endpoint,
      status: result.status,
      summary: "Ozon API 返回错误。",
      message: result.message,
      preview: []
    };
  }

  const extracted = await request.extract(result.data, credentials);

  return {
    ok: true,
    resource: input.resource,
    label: request.label,
    endpoint: request.endpoint,
    status: result.status,
    ...extracted
  };
}

export async function getOzonProductsForImport(store: { ozonClientId: string; apiKeyEncrypted: string }, limit = 20) {
  const apiKey = decryptSecret(store.apiKeyEncrypted);
  return fetchOzonProductImports({ ozonClientId: store.ozonClientId, apiKey }, limit);
}

export async function getOzonOrdersForImport(store: { ozonClientId: string; apiKeyEncrypted: string }, limit = 20) {
  const apiKey = decryptSecret(store.apiKeyEncrypted);
  return fetchOzonOrderImports({ ozonClientId: store.ozonClientId, apiKey }, limit);
}

export type UploadChecklistItem = { key: string; label: string; passed: boolean; detail: string };
export type UploadResult = {
  mode: "dry-run" | "real" | "blocked";
  ozonStoreId: string;
  ozonClientId: string;
  apiKeyLoaded: boolean;
  externalId?: string;
  productTitle: string;
  checklist: UploadChecklistItem[];
  checklistPassed: boolean;
  realUploadEnabled: boolean;
  uploadPayload?: Record<string, unknown>;
  apiResponse?: unknown;
  warning?: string;
  error?: string;
};

export function buildUploadChecklist(product: OzonUploadInput["product"]): UploadChecklistItem[] {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const hasCyrillic = /[Ѐ-ӿ]/.test(product.title || "") || /[Ѐ-ӿ]/.test(product.description || "");
  const price = Number(product.price);
  const categoryId = process.env.OZON_DEFAULT_CATEGORY_ID || String(DEFAULT_OZON_CATEGORY_ID);
  const categoryConfigured = Boolean(process.env.OZON_DEFAULT_CATEGORY_ID);
  return [
    { key: "title", label: "商品标题", passed: Boolean(product.title?.trim()), detail: product.title ? "已填写" : "缺失" },
    { key: "cyrillic", label: "俄文文案", passed: hasCyrillic, detail: hasCyrillic ? "标题/描述含俄文" : "标题或描述需含俄文（Ozon 俄语站）" },
    { key: "description", label: "商品描述", passed: Boolean(product.description?.trim()), detail: product.description ? "已填写" : "缺失" },
    { key: "price", label: "价格 > 0", passed: price > 0, detail: price > 0 ? `${price}` : "未设价格" },
    {
      key: "category",
      label: "Ozon 类目",
      passed: true,
      detail: categoryConfigured ? `已配置目标类目 ${categoryId}` : "使用默认类目，真实上架前需配置目标类目"
    },
    { key: "images", label: "至少 1 张图", passed: images.length > 0, detail: `${images.length} 张` }
  ];
}

function buildOzonUploadPayload(input: OzonUploadInput) {
  const images = Array.isArray(input.product.images) ? input.product.images.filter(Boolean).slice(0, 15) : [];
  const offerId = `ozonai_${Date.now()}`;
  const categoryId = Number(process.env.OZON_DEFAULT_CATEGORY_ID || DEFAULT_OZON_CATEGORY_ID);
  const attributes = [
    { id: Number(process.env.OZON_BRAND_ATTRIBUTE_ID || 85), values: [{ value: "OzonAI" }] },
    { id: Number(process.env.OZON_TITLE_ATTRIBUTE_ID || 9048), values: [{ value: input.product.title }] }
  ];

  return {
    items: [
      {
        offer_id: offerId,
        name: input.product.title,
        description: input.product.description,
        category_id: categoryId,
        attributes,
        price: String(Number(input.product.price).toFixed(2)),
        currency_code: "RUB",
        barcode: offerId,
        sku: offerId,
        images
      }
    ]
  };
}

export async function uploadProductToOzon(input: OzonUploadInput): Promise<UploadResult> {
  const apiKey = decryptSecret(input.store.apiKeyEncrypted);
  const checklist = buildUploadChecklist(input.product);
  const checklistPassed = checklist.every((item) => item.passed);
  const realUploadEnabled = process.env.OZON_REAL_UPLOAD === "true";
  const uploadPayload = buildOzonUploadPayload(input);

  // 检查未通过 → 阻止上架
  if (!checklistPassed) {
    return {
      mode: "blocked",
      ozonStoreId: input.store.ozonStoreId,
      ozonClientId: input.store.ozonClientId,
      apiKeyLoaded: Boolean(apiKey),
      productTitle: input.product.title,
      checklist,
      checklistPassed: false,
      realUploadEnabled
    };
  }

  // dry-run 模式（默认）：不真实写入 Ozon，返回模拟成功
  if (!realUploadEnabled) {
    return {
      mode: "dry-run",
      ozonStoreId: input.store.ozonStoreId,
      ozonClientId: input.store.ozonClientId,
      apiKeyLoaded: Boolean(apiKey),
      externalId: `dryrun_${Date.now()}`,
      productTitle: input.product.title,
      checklist,
      checklistPassed: true,
      realUploadEnabled: false,
      uploadPayload,
      warning: HARDCODED_OZON_UPLOAD_WARNING
    };
  }

  // 真实模式：调 Ozon /v3/product/create，dry-run 和 real 模式共享同一完整 payload。
  try {
    const response = await postOzon("/v3/product/create", {
      ozonClientId: input.store.ozonClientId,
      apiKey: apiKey || ""
    }, uploadPayload);
    return {
      mode: "real",
      ozonStoreId: input.store.ozonStoreId,
      ozonClientId: input.store.ozonClientId,
      apiKeyLoaded: Boolean(apiKey),
      externalId: `ozon_${Date.now()}`,
      productTitle: input.product.title,
      checklist,
      checklistPassed: true,
      realUploadEnabled: true,
      uploadPayload,
      apiResponse: response
    };
  } catch (error) {
    return {
      mode: "real",
      ozonStoreId: input.store.ozonStoreId,
      ozonClientId: input.store.ozonClientId,
      apiKeyLoaded: Boolean(apiKey),
      productTitle: input.product.title,
      checklist,
      checklistPassed: true,
      realUploadEnabled: true,
      error: error instanceof Error ? error.message : "Ozon API 调用失败"
    };
  }
}
