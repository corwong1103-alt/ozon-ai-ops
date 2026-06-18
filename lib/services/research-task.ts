import "server-only";

import { prisma } from "@/lib/prisma";
import {
  categoryKeyword,
  ozonKeyword,
  searchCategory,
  searchProducts,
  type OzonMarketProduct
} from "@/lib/services/ozon-market";
import { toOzonMarketUiProduct } from "@/lib/ozon-market-normalizer";
import type { OzonMarketUiProduct } from "@/lib/ozon-market-normalizer";

const DEFAULT_LIMIT = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 计算归一化后的搜索词与 category，作为缓存/任务的统一 key。 */
export function resolveSearchKey(keyword: string, categoryId?: string) {
  const rawKeyword = keyword.trim();
  const searchKeyword = rawKeyword || categoryKeyword(categoryId) || "";
  const normalizedKeyword = ozonKeyword(searchKeyword);
  const category = categoryId || "";
  return { normalizedKeyword, category, hasQuery: Boolean(normalizedKeyword) };
}

/**
 * Page 层专用：缓存命中→SSR 直出商品；未命中→创建/复用任务→返回 taskId。
 * 不阻塞：未命中时不调 Apify（由 executeResearchTask 后台执行）。
 */
export async function resolveMarketSearchForPage(input: {
  userId: string;
  keyword: string;
  categoryId?: string;
}): Promise<
  | { mode: "cache_hit"; products: OzonMarketUiProduct[]; message: string }
  | { mode: "task_pending"; taskId: string; message: string }
  | { mode: "no_query"; message: string }
> {
  const { normalizedKeyword, category, hasQuery } = resolveSearchKey(input.keyword, input.categoryId);
  if (!hasQuery) return { mode: "no_query", message: "请输入关键词或选择类目。" };

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
    const products = (cached.result as unknown as OzonMarketProduct[]).map(toOzonMarketUiProduct);
    const cacheAgeS = Math.round((Date.now() - cached.createdAt.getTime()) / 1000);
    console.info("[page_cache_hit]", JSON.stringify({
      keyword: normalizedKeyword, category,
      productCount: products.length, cacheLookupMs, hitWriteMs,
      hitCount: cached.hitCount + 1, cacheAgeS
    }));
    return {
      mode: "cache_hit",
      products,
      message: `已从缓存读取 ${products.length} 个 Ozon 市场商品（累计命中 ${cached.hitCount + 1} 次，缓存年龄 ${cacheAgeS}s）。`
    };
  }

  const { taskId, reused } = await createOrReuseResearchTask({
    userId: input.userId,
    keyword: input.keyword,
    categoryId: input.categoryId
  });
  console.info("[page_task_pending]", JSON.stringify({
    keyword: normalizedKeyword, category, taskId, reused
  }));
  return {
    mode: "task_pending",
    taskId,
    message: reused
      ? "已加入正在进行的调研任务，后台抓取中..."
      : "正在调研市场，后台调用 Apify 抓取真实商品..."
  };
}

/**
 * 创建或复用搜索任务。
 * 并发去重：同 keyword+category 已有 queued/processing 任务时复用，避免多标签页重复调 Apify。
 * 创建后 fire-and-forget 后台执行（不 await），立即返回 taskId。
 */
export async function createOrReuseResearchTask(input: {
  userId: string;
  keyword: string;
  categoryId?: string;
}): Promise<{ taskId: string; reused: boolean }> {
  const { normalizedKeyword, category } = resolveSearchKey(input.keyword, input.categoryId);

  const existing = await prisma.researchTask.findFirst({
    where: {
      keyword: normalizedKeyword,
      category,
      status: { in: ["queued", "processing"] }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    return { taskId: existing.id, reused: true };
  }

  const task = await prisma.researchTask.create({
    data: {
      userId: input.userId,
      keyword: normalizedKeyword,
      category,
      status: "queued"
    }
  });

  // fire-and-forget：不 await，让 API 立即返回
  void executeResearchTask(task.id).catch((error) => {
    console.error("[research_task_executor_fatal]", { taskId: task.id, error: error instanceof Error ? error.message : String(error) });
  });

  return { taskId: task.id, reused: false };
}

/**
 * 后台执行搜索任务。
 * 1. 查 MarketSearchCache（命中则直接成功，fromCache=true）
 * 2. 未命中调 Apify（searchProducts/searchCategory）
 * 3. 写 MarketSearchCache（TTL 24h）
 * 4. 更新 ResearchTask.status=success + result
 * 失败：status=failed + errorMessage
 */
export async function executeResearchTask(taskId: string): Promise<void> {
  const task = await prisma.researchTask.findUnique({ where: { id: taskId } });
  if (!task) return;
  if (task.status === "success" || task.status === "processing") {
    // 已完成或已在执行（并发保护）
    if (task.status === "success") return;
  }

  await prisma.researchTask.update({
    where: { id: taskId },
    data: { status: "processing" }
  });

  const t0 = Date.now();
  try {
    // ── 1. 查缓存 ──
    const cacheLookupStart = Date.now();
    const cached = await prisma.marketSearchCache.findUnique({
      where: { keyword_category: { keyword: task.keyword, category: task.category } }
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
      const uiProducts = products.map(toOzonMarketUiProduct);
      await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "success",
          result: uiProducts as unknown as object,
          productCount: products.length,
          fromCache: true
        }
      });
      console.info("[research_task_cache_hit]", JSON.stringify({
        taskId, keyword: task.keyword, category: task.category,
        productCount: products.length, cacheLookupMs, hitWriteMs, totalMs: Date.now() - t0
      }));
      return;
    }

    // ── 2. 未命中调 Apify ──
    const apifyStart = Date.now();
    const products = task.keyword
      ? await searchProducts({ userId: task.userId, keyword: task.keyword, limit: DEFAULT_LIMIT })
      : await searchCategory({ userId: task.userId, categoryId: task.category || undefined, limit: DEFAULT_LIMIT });
    const apifyMs = Date.now() - apifyStart;

    // ── 3. 写缓存 ──
    const cacheWriteStart = Date.now();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await prisma.marketSearchCache.upsert({
      where: { keyword_category: { keyword: task.keyword, category: task.category } },
      create: {
        keyword: task.keyword, category: task.category,
        result: products as unknown as object,
        productCount: products.length, source: "apify", expiresAt
      },
      update: {
        result: products as unknown as object,
        productCount: products.length, source: "apify", expiresAt, hitCount: 0
      }
    });
    const cacheWriteMs = Date.now() - cacheWriteStart;

    // ── 4. 任务成功 ──
    const uiProducts = products.map(toOzonMarketUiProduct);
    await prisma.researchTask.update({
      where: { id: taskId },
      data: {
        status: "success",
        result: uiProducts as unknown as object,
        productCount: products.length,
        fromCache: false
      }
    });

    console.info("[research_task_apify_done]", JSON.stringify({
      taskId, keyword: task.keyword, category: task.category,
      productCount: products.length, cacheLookupMs, apifyMs, cacheWriteMs, totalMs: Date.now() - t0
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.researchTask.update({
      where: { id: taskId },
      data: { status: "failed", errorMessage: errorMessage.slice(0, 500) }
    });
    console.info("[research_task_failed]", JSON.stringify({
      taskId, keyword: task.keyword, category: task.category,
      totalMs: Date.now() - t0, error: errorMessage.slice(0, 200)
    }));
  }
}

/** 查询任务状态（校验 userId 归属）。返回前端可用的 UI product 数组。 */
export async function getResearchTaskForUser(taskId: string, userId: string) {
  const task = await prisma.researchTask.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== userId) return null;
  return {
    id: task.id,
    status: task.status,
    keyword: task.keyword,
    category: task.category,
    productCount: task.productCount,
    errorMessage: task.errorMessage,
    fromCache: task.fromCache,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    products: task.status === "success" && task.result
      ? (task.result as unknown as ReturnType<typeof toOzonMarketUiProduct>[])
      : []
  };
}

/** 失败任务重试：重置为 queued 并重新触发执行。 */
export async function retryResearchTask(taskId: string, userId: string): Promise<{ ok: boolean; taskId?: string; message: string }> {
  const task = await prisma.researchTask.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== userId) {
    return { ok: false, message: "任务不存在或无权访问。" };
  }
  if (task.status === "queued" || task.status === "processing") {
    return { ok: false, message: "任务正在执行中，无需重试。", taskId };
  }
  await prisma.researchTask.update({
    where: { id: taskId },
    data: { status: "queued", errorMessage: null, fromCache: false }
  });
  void executeResearchTask(taskId).catch((error) => {
    console.error("[research_task_retry_fatal]", { taskId, error: error instanceof Error ? error.message : String(error) });
  });
  return { ok: true, taskId, message: "已重新触发搜索。" };
}
