import "server-only";

import { decryptSecret } from "@/lib/crypto";
import { readPublicConfig } from "@/lib/integrations";
import {
  normalizeApifyOzonProduct,
  toOzonMarketUiProduct,
  type OzonMarketProduct,
  type OzonMarketUiProduct
} from "@/lib/ozon-market-normalizer";
import { prisma } from "@/lib/prisma";
import { MARKET_SEARCH_CACHE_TTL_LABEL, MARKET_SEARCH_CACHE_TTL_MS } from "@/lib/search-intelligence";
import { ozonMarketCategories, type OzonMarketCategory } from "@/lib/services/ozon-market-categories";

const DEFAULT_LIMIT = 20;
const DEFAULT_ACTOR_ID = "zen-studio/ozon-scraper-pro";
const APIFY_BASE_URL = "https://api.apify.com/v2";
const FINAL_RUN_STATUSES = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export type { OzonMarketProduct };

export class MarketSourceNotConfiguredError extends Error {
  code = "MARKET_SOURCE_NOT_CONFIGURED" as const;

  constructor(message = "当前账号未配置 Ozon Market / Apify 数据源，无法进行真实市场调研。") {
    super(message);
    this.name = "MarketSourceNotConfiguredError";
  }
}

export type { OzonMarketCategory } from "@/lib/services/ozon-market-categories";

export type OzonMarketSearchResult = {
  mode: "configured" | "unconfigured" | "error";
  sourceName: string;
  message: string;
  products: OzonMarketUiProduct[];
};

export { ozonMarketCategories } from "@/lib/services/ozon-market-categories";

export function categoryKeyword(categoryId?: string) {
  return ozonMarketCategories.find((item) => item.id === categoryId)?.keywords[0] || "";
}

export function ozonKeyword(keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  const aliases: Record<string, string> = {
    backpack: "рюкзак",
    "phone case": "чехол для телефона",
    "pet toy": "игрушка для животных",
    "裤子": "брюки",
    "裤": "брюки",
    "牛仔裤": "джинсы"
  };
  return aliases[normalized] || keyword.trim();
}

async function getMarketIntegration(userId?: string) {
  if (userId) {
    const own = await prisma.apiIntegration.findUnique({
      where: { userId_provider: { userId, provider: "ozon_market" } }
    });
    if (own?.secretEncrypted || readPublicConfig(own?.publicConfig).actorId) return own;
  }

  return prisma.apiIntegration.findFirst({
    where: {
      provider: "ozon_market",
      user: { role: "admin" }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getOzonMarketRuntimeConfig(userId?: string) {
  const integration = await getMarketIntegration(userId);
  const publicConfig = readPublicConfig(integration?.publicConfig);
  const token = integration?.secretEncrypted ? decryptSecret(integration.secretEncrypted) : process.env.APIFY_TOKEN || "";
  const actorId = publicConfig.actorId || process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR_ID;
  const configSource = integration?.userId === userId
    ? "seller_integration"
    : integration
      ? "admin_global_integration"
      : token
        ? "env"
        : "missing";
  console.info("[ozon_market_config]", JSON.stringify({
    userId,
    configSource,
    provider: integration?.provider || "env",
    status: integration?.status || "env",
    hasToken: Boolean(token),
    actorId,
    configured: Boolean(token && actorId)
  }));

  return {
    configured: Boolean(token && actorId),
    token,
    actorId,
    maxItems: Number(publicConfig.maxItems || DEFAULT_LIMIT) || DEFAULT_LIMIT,
    sourceName: integration?.accountLabel || "Apify Ozon Market",
    configSource
  };
}

function ozonSearchUrl(keyword: string) {
  const url = new URL("https://www.ozon.ru/search/");
  url.searchParams.set("text", keyword);
  return url.toString();
}

function buildActorInput(input: {
  keyword?: string;
  category?: string;
  productUrl?: string;
  limit?: number;
}) {
  const query = (input.keyword || input.category || "").trim();
  const limit = input.limit || DEFAULT_LIMIT;
  const startUrl = input.productUrl || (query ? ozonSearchUrl(query) : "https://www.ozon.ru/");

  return {
    urls: [startUrl],
    startUrls: [{ url: startUrl }],
    searchUrls: [startUrl],
    searchQueries: query ? [query] : [],
    query,
    keyword: query,
    maxResults: limit,
    maxItems: limit,
    maxProducts: limit,
    limit,
    proxyConfiguration: { useApifyProxy: true }
  };
}

function actorIdForPath(actorId: string) {
  return actorId.trim().replace("/", "~");
}

function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 10) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 8)}***${token.slice(-4)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ApifyRun = {
  id?: string;
  status?: string;
  defaultDatasetId?: string;
  startedAt?: string;
  finishedAt?: string;
  statusMessage?: string;
};

function asRun(payload: unknown): ApifyRun {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  return {
    id: typeof data.id === "string" ? data.id : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    defaultDatasetId: typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : undefined,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : undefined,
    finishedAt: typeof data.finishedAt === "string" ? data.finishedAt : undefined,
    statusMessage: typeof data.statusMessage === "string" ? data.statusMessage : undefined
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return {
      text,
      json: text ? JSON.parse(text) as unknown : null
    };
  } catch {
    return {
      text,
      json: null
    };
  }
}

async function fetchApifyJson(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  const body = await readJsonResponse(response);
  return { response, ...body };
}

async function startApifyActor(input: {
  token: string;
  actorId: string;
  body: Record<string, unknown>;
}) {
  const requestUrl = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorIdForPath(input.actorId))}/runs`;
  return fetchApifyJson(requestUrl, input.token, {
    method: "POST",
    body: JSON.stringify(input.body)
  });
}

async function getApifyRun(input: { token: string; runId: string }) {
  return fetchApifyJson(`${APIFY_BASE_URL}/actor-runs/${encodeURIComponent(input.runId)}`, input.token);
}

async function abortApifyRun(input: { token: string; runId: string }) {
  return fetchApifyJson(`${APIFY_BASE_URL}/actor-runs/${encodeURIComponent(input.runId)}/abort`, input.token, { method: "POST" });
}

async function getApifyDatasetItems(input: { token: string; datasetId: string }) {
  const url = new URL(`${APIFY_BASE_URL}/datasets/${encodeURIComponent(input.datasetId)}/items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("format", "json");
  return fetchApifyJson(url.toString(), input.token);
}

async function runApifyActorWithPolling(input: {
  userId?: string;
  keyword?: string;
  category?: string;
  productUrl?: string;
  limit?: number;
  timeoutMs?: number;
  abortOnTimeout?: boolean;
  debug?: boolean;
}) {
  const config = await getOzonMarketRuntimeConfig(input.userId);
  const logs: Array<Record<string, unknown>> = [];
  const timing = { t0: Date.now(), tActorStart: 0, tFirstPoll: 0, tLastPoll: 0, pollCount: 0, tDataset: 0, tAbort: 0 };
  if (!config.configured) {
    throw new MarketSourceNotConfiguredError();
  }

  const body = buildActorInput(input);
  const requestUrl = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorIdForPath(config.actorId))}/runs`;
  logs.push({
    step: "request",
    method: "POST",
    url: requestUrl,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${maskToken(config.token)}`
    },
    body
  });

  const startResult = await startApifyActor({ token: config.token, actorId: config.actorId, body });
  timing.tActorStart = Date.now();
  logs.push({
    step: "actor-start",
    statusCode: startResult.response.status,
    ok: startResult.response.ok,
    raw: startResult.json ?? startResult.text
  });

  if (!startResult.response.ok) {
    console.info("[apify_timing]", JSON.stringify({
      keyword: input.keyword || input.category || "",
      status: "ACTOR_START_FAILED",
      httpStatus: startResult.response.status,
      itemCount: 0,
      actorStartMs: timing.tActorStart - timing.t0,
      firstPollLatencyMs: 0,
      pollingMs: 0,
      pollCount: 0,
      datasetMs: 0,
      abortMs: 0,
      totalMs: Date.now() - timing.t0
    }));
    throw new Error(startResult.text.slice(0, 800) || `Apify start HTTP ${startResult.response.status}`);
  }

  let run = asRun(startResult.json);
  logs.push({
    step: "actor-started",
    message: "Actor启动成功",
    runId: run.id,
    datasetId: run.defaultDatasetId,
    status: run.status || "UNKNOWN"
  });

  if (!run.id) {
    throw new Error("Apify 已响应，但没有返回 Run ID。");
  }
  const runId = run.id;

  const timeoutMs = input.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;
  while (!FINAL_RUN_STATUSES.has(run.status || "") && Date.now() < deadline) {
    await sleep(2_000);
    const pollResult = await getApifyRun({ token: config.token, runId });
    timing.pollCount += 1;
    timing.tLastPoll = Date.now();
    if (!timing.tFirstPoll) timing.tFirstPoll = timing.tLastPoll;
    logs.push({
      step: "polling",
      statusCode: pollResult.response.status,
      ok: pollResult.response.ok,
      raw: pollResult.json ?? pollResult.text
    });
    if (!pollResult.response.ok) {
      throw new Error(pollResult.text.slice(0, 800) || `Apify poll HTTP ${pollResult.response.status}`);
    }
    run = asRun(pollResult.json);
    logs.push({
      step: "run-status",
      runId: run.id,
      datasetId: run.defaultDatasetId,
      status: run.status || "UNKNOWN",
      statusMessage: run.statusMessage
    });
  }

  if (!FINAL_RUN_STATUSES.has(run.status || "")) {
    let partialItems: unknown[] = [];
    if (run.defaultDatasetId) {
      const partialDatasetResult = await getApifyDatasetItems({ token: config.token, datasetId: run.defaultDatasetId });
      logs.push({
        step: "dataset-items-partial-before-abort",
        statusCode: partialDatasetResult.response.status,
        ok: partialDatasetResult.response.ok,
        datasetId: run.defaultDatasetId,
        raw: partialDatasetResult.json ?? partialDatasetResult.text
      });
      partialItems = Array.isArray(partialDatasetResult.json) ? partialDatasetResult.json : [];
      timing.tDataset = Date.now();
    }
    logs.push({
      step: "timeout",
      status: run.status || "UNKNOWN",
      runId,
      datasetId: run.defaultDatasetId,
      message: `${timeoutMs}ms 内未完成，终止本次等待。`
    });
    if (input.abortOnTimeout) {
      const abortResult = await abortApifyRun({ token: config.token, runId });
      timing.tAbort = Date.now();
      logs.push({
        step: "abort",
        statusCode: abortResult.response.status,
        ok: abortResult.response.ok,
        raw: abortResult.json ?? abortResult.text
      });
    }
    console.info("[apify_timing]", JSON.stringify({
      keyword: input.keyword || input.category || "",
      status: run.status || "TIMEOUT",
      itemCount: partialItems.length,
      actorStartMs: timing.tActorStart - timing.t0,
      firstPollLatencyMs: timing.tFirstPoll ? timing.tFirstPoll - timing.tActorStart : 0,
      pollingMs: timing.tFirstPoll ? timing.tLastPoll - timing.tFirstPoll : 0,
      pollCount: timing.pollCount,
      datasetMs: timing.tDataset ? timing.tDataset - timing.tLastPoll : 0,
      abortMs: timing.tAbort ? timing.tAbort - timing.tDataset : 0,
      totalMs: Date.now() - timing.t0
    }));
    return { items: partialItems, logs, run };
  }

  if (run.status !== "SUCCEEDED") {
    console.info("[apify_timing]", JSON.stringify({
      keyword: input.keyword || input.category || "",
      status: run.status || "FAILED",
      itemCount: 0,
      actorStartMs: timing.tActorStart - timing.t0,
      firstPollLatencyMs: timing.tFirstPoll ? timing.tFirstPoll - timing.tActorStart : 0,
      pollingMs: timing.tFirstPoll ? timing.tLastPoll - timing.tFirstPoll : 0,
      pollCount: timing.pollCount,
      datasetMs: 0,
      abortMs: 0,
      totalMs: Date.now() - timing.t0
    }));
    return { items: [] as unknown[], logs, run };
  }

  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    logs.push({ step: "dataset", status: "MISSING", message: "Run 成功但没有 defaultDatasetId。" });
    console.info("[apify_timing]", JSON.stringify({
      keyword: input.keyword || input.category || "",
      status: "SUCCEEDED_NO_DATASET",
      itemCount: 0,
      actorStartMs: timing.tActorStart - timing.t0,
      pollingMs: timing.tFirstPoll ? timing.tLastPoll - timing.tFirstPoll : 0,
      pollCount: timing.pollCount,
      totalMs: Date.now() - timing.t0
    }));
    return { items: [] as unknown[], logs, run };
  }

  const datasetResult = await getApifyDatasetItems({ token: config.token, datasetId });
  timing.tDataset = Date.now();
  logs.push({
    step: "dataset-items",
    statusCode: datasetResult.response.status,
    ok: datasetResult.response.ok,
    datasetId,
    raw: datasetResult.json ?? datasetResult.text
  });

  if (!datasetResult.response.ok) {
    throw new Error(datasetResult.text.slice(0, 800) || `Apify dataset HTTP ${datasetResult.response.status}`);
  }

  const finalItems = Array.isArray(datasetResult.json) ? datasetResult.json : [];
  console.info("[apify_timing]", JSON.stringify({
    keyword: input.keyword || input.category || "",
    status: run.status || "SUCCEEDED",
    itemCount: finalItems.length,
    actorStartMs: timing.tActorStart - timing.t0,
    firstPollLatencyMs: timing.tFirstPoll ? timing.tFirstPoll - timing.tActorStart : 0,
    pollingMs: timing.tFirstPoll ? timing.tLastPoll - timing.tFirstPoll : 0,
    pollCount: timing.pollCount,
    datasetMs: timing.tDataset ? timing.tDataset - timing.tLastPoll : 0,
    abortMs: 0,
    totalMs: Date.now() - timing.t0
  }));
  return {
    items: finalItems,
    logs,
    run
  };
}

async function runApifyActor(input: {
  userId?: string;
  keyword?: string;
  category?: string;
  productUrl?: string;
  limit?: number;
}) {
  const result = await runApifyActorWithPolling({ ...input, timeoutMs: 30_000, abortOnTimeout: true });
  return result.items;
}

function normalizeItems(items: unknown[], limit = DEFAULT_LIMIT) {
  return items
    .map(normalizeApifyOzonProduct)
    .filter((item): item is OzonMarketProduct => Boolean(item))
    .sort((a, b) => {
      const score = (item: OzonMarketProduct) =>
        (item.price !== undefined ? 10 : 0) +
        ((item.images?.length || item.imageUrl) ? 5 : 0) +
        (item.rating !== undefined ? 2 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
}

export async function searchProducts(input: {
  userId?: string;
  keyword: string;
  limit?: number;
}): Promise<OzonMarketProduct[]> {
  const keyword = ozonKeyword(input.keyword);
  if (!keyword) return [];
  const items = await runApifyActor({ userId: input.userId, keyword, limit: input.limit || DEFAULT_LIMIT });
  return normalizeItems(items, input.limit || DEFAULT_LIMIT);
}

export async function searchCategory(input: {
  userId?: string;
  categoryId?: string;
  keyword?: string;
  limit?: number;
}): Promise<OzonMarketProduct[]> {
  const keyword = input.keyword?.trim() ? ozonKeyword(input.keyword) : categoryKeyword(input.categoryId);
  if (!keyword) return [];
  const items = await runApifyActor({ userId: input.userId, category: keyword, limit: input.limit || DEFAULT_LIMIT });
  return normalizeItems(items, input.limit || DEFAULT_LIMIT);
}

export async function getProductDetails(input: {
  userId?: string;
  productUrl?: string;
  externalId?: string;
}): Promise<OzonMarketProduct | null> {
  const productUrl = input.productUrl?.trim();
  if (!productUrl && !input.externalId) return null;
  const items = await runApifyActor({
    userId: input.userId,
    productUrl: productUrl || `https://www.ozon.ru/product/${input.externalId}/`,
    limit: 1
  });
  return normalizeItems(items, 1)[0] || null;
}

export async function testOzonMarketConnection(userId: string) {
  const startedAt = Date.now();
  const result = await runApifyActorWithPolling({
    userId,
    keyword: "backpack",
    limit: 20,
    timeoutMs: 30_000,
    abortOnTimeout: true,
    debug: true
  });
  const products = normalizeItems(result.items, 20);
  return {
    ok: products.length > 0,
    count: products.length,
    responseMs: Date.now() - startedAt,
    status: result.run?.status || "UNKNOWN",
    runId: result.run?.id,
    datasetId: result.run?.defaultDatasetId,
    logs: result.logs,
    products
  };
}

export async function searchOzonMarketProducts(input: {
  userId: string;
  keyword?: string;
  categoryId?: string;
  limit?: number;
}): Promise<OzonMarketSearchResult> {
  const t0 = Date.now();
  const config = await getOzonMarketRuntimeConfig(input.userId);
  if (!config.configured) {
    return {
      mode: "unconfigured",
      sourceName: config.sourceName,
      message: "尚未接入 Apify Ozon Market。当前不会展示假商品；请在 API 接入中心保存 Apify Token 和 Actor ID。",
      products: []
    };
  }

  const limit = input.limit || DEFAULT_LIMIT;
  const rawKeyword = input.keyword?.trim() || "";
  const searchKeyword = rawKeyword || categoryKeyword(input.categoryId) || "";
  const normalizedKeyword = ozonKeyword(searchKeyword);
  const category = input.categoryId || "";

  if (!normalizedKeyword) {
    return {
      mode: "configured",
      sourceName: config.sourceName,
      message: "请输入关键词或选择类目。",
      products: []
    };
  }

  // ── P0-1: 前置查缓存 ──
  const cacheLookupStart = Date.now();
  const cached = await prisma.marketSearchCache.findUnique({
    where: { keyword_category: { keyword: normalizedKeyword, category } }
  });
  const cacheLookupMs = Date.now() - cacheLookupStart;

  if (cached && cached.expiresAt > new Date()) {
    const hitWriteStart = Date.now();
    await prisma.marketSearchCache.update({
      where: { id: cached.id },
      data: { hitCount: { increment: 1 }, updatedAt: new Date() }
    });
    const hitWriteMs = Date.now() - hitWriteStart;
    const products = cached.result as unknown as OzonMarketProduct[];
    const totalMs = Date.now() - t0;
    const cacheAgeS = Math.round((Date.now() - cached.createdAt.getTime()) / 1000);
    console.info("[cache_hit]", JSON.stringify({
      keyword: normalizedKeyword,
      category,
      productCount: products.length,
      cacheLookupMs,
      hitWriteMs,
      totalMs,
      hitCount: cached.hitCount + 1,
      cacheAgeS
    }));

    return {
      mode: "configured",
      sourceName: config.sourceName,
      message: `已从缓存读取 ${products.length} 个 Ozon 市场商品（${MARKET_SEARCH_CACHE_TTL_LABEL}内已抓取，累计命中 ${cached.hitCount + 1} 次，缓存年龄 ${cacheAgeS}s）。`,
      products: products.map(toOzonMarketUiProduct)
    };
  }

  // ── 未命中：调 Apify ──
  try {
    const apifyStart = Date.now();
    const products = rawKeyword
      ? await searchProducts({ userId: input.userId, keyword: rawKeyword, limit })
      : await searchCategory({ userId: input.userId, categoryId: input.categoryId || undefined, limit });
    const apifyMs = Date.now() - apifyStart;

    // 写缓存（upsert：已过期记录直接覆盖，hitCount 重置）
    const cacheWriteStart = Date.now();
    const expiresAt = new Date(Date.now() + MARKET_SEARCH_CACHE_TTL_MS);
    await prisma.marketSearchCache.upsert({
      where: { keyword_category: { keyword: normalizedKeyword, category } },
      create: {
        keyword: normalizedKeyword,
        category,
        result: products as unknown as object,
        productCount: products.length,
        source: "apify",
        expiresAt
      },
      update: {
        result: products as unknown as object,
        productCount: products.length,
        source: "apify",
        expiresAt,
        hitCount: 0
      }
    });
    const cacheWriteMs = Date.now() - cacheWriteStart;
    const totalMs = Date.now() - t0;

    const first = products[0];
    console.info("[cache_miss_apify]", JSON.stringify({
      keyword: normalizedKeyword,
      category,
      count: products.length,
      cacheLookupMs,
      apifyMs,
      cacheWriteMs,
      totalMs,
      firstTitle: first?.title || "",
      firstPrice: first?.price ?? null
    }));

    return {
      mode: "configured",
      sourceName: config.sourceName,
      message: products.length
        ? `已通过 Apify 读取 ${products.length} 个真实 Ozon 市场商品。`
        : "Apify 已连接，但当前关键词/类目没有返回商品。",
      products: products.map(toOzonMarketUiProduct)
    };
  } catch (error) {
    const totalMs = Date.now() - t0;
    console.info("[cache_miss_error]", JSON.stringify({
      keyword: normalizedKeyword,
      category,
      totalMs,
      error: error instanceof Error ? error.message : String(error)
    }));
    return {
      mode: "error",
      sourceName: config.sourceName,
      message: error instanceof Error ? `Apify Ozon Market 请求失败：${error.message}` : "Apify Ozon Market 请求失败。",
      products: []
    };
  }
}
