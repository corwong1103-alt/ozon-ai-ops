import "server-only";

import { decryptSecret } from "@/lib/crypto";
import { readPublicConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

/**
 * 通用 Apify 客户端。
 *
 * 设计目标：
 * - 抽象 ozon-market.ts 已验证的「启动 Actor → 轮询状态 → 超时读取 partial Dataset → 必要时 abort」流程
 * - 支持任意 actorId / input，复用于 Ozon、1688 等数据源
 * - 内置 retry + 错误处理，调用方不暴露 token
 *
 * Token 来源优先级（与 ozon_market 一致）：
 *   1. 当前用户的 integration 加密密钥
 *   2. 管理员全局 integration 加密密钥
 *   3. 环境变量 APIFY_TOKEN
 */

const APIFY_BASE_URL = "https://api.apify.com/v2";
const FINAL_RUN_STATUSES = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export class ApifyNotConfiguredError extends Error {
  code = "APIFY_NOT_CONFIGURED" as const;

  constructor(message = "当前账号未配置 Apify Token，无法调用第三方采集数据源。") {
    super(message);
    this.name = "ApifyNotConfiguredError";
  }
}

export class ApifyActorError extends Error {
  code = "APIFY_ACTOR_FAILED" as const;

  constructor(
    message: string,
    public runStatus?: string,
    public runId?: string
  ) {
    super(message);
    this.name = "ApifyActorError";
  }
}

export type ApifyRunResult = {
  items: unknown[];
  runId?: string;
  datasetId?: string;
  status: string;
  timedOut: boolean;
  totalMs: number;
};

export type ApifyTokenSource =
  | "seller_integration"
  | "seller_ozon_market_integration"
  | "admin_global_integration"
  | "admin_ozon_market_integration"
  | "env"
  | "missing";

export type ApifyRuntimeConfig = {
  configured: boolean;
  token: string;
  tokenSource: ApifyTokenSource;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function actorIdForPath(actorId: string) {
  return actorId.trim().replace("/", "~");
}

function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 10) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 8)}***${token.slice(-4)}`;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return { text, json: text ? (JSON.parse(text) as unknown) : null };
  } catch {
    return { text, json: null };
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

type ApifyRun = {
  id?: string;
  status?: string;
  defaultDatasetId?: string;
  statusMessage?: string;
};

function asRun(payload: unknown): ApifyRun {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : record;
  return {
    id: typeof data.id === "string" ? data.id : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
    defaultDatasetId: typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : undefined,
    statusMessage: typeof data.statusMessage === "string" ? data.statusMessage : undefined
  };
}

/**
 * 解析 Apify Token 来源。与 ozon_market 不同，1688 走独立的 source_1688 integration，
 * 但 Token 本身可以与 ozon_market 共用同一个 Apify 账号，因此这里按 provider 查找，
 * 找不到时回落到 ozon_market，最后回落到环境变量。
 */
export async function getApifyRuntimeConfig(
  userId: string | undefined,
  provider: "source_1688" | "ozon_market" = "source_1688"
): Promise<ApifyRuntimeConfig> {
  if (userId) {
    const own = await prisma.apiIntegration.findUnique({
      where: { userId_provider: { userId, provider } }
    });
    if (own?.secretEncrypted) {
      return {
        configured: true,
        token: decryptSecret(own.secretEncrypted),
        tokenSource: "seller_integration"
      };
    }

    if (provider !== "ozon_market") {
      const sharedApify = await prisma.apiIntegration.findUnique({
        where: { userId_provider: { userId, provider: "ozon_market" } }
      });
      if (sharedApify?.secretEncrypted) {
        return {
          configured: true,
          token: decryptSecret(sharedApify.secretEncrypted),
          tokenSource: "seller_ozon_market_integration"
        };
      }
    }
  }

  // 回落：管理员全局同 provider 配置
  const adminGlobal = await prisma.apiIntegration.findFirst({
    where: { provider, user: { role: "admin" } },
    orderBy: { updatedAt: "desc" }
  });
  if (adminGlobal?.secretEncrypted) {
    return {
      configured: true,
      token: decryptSecret(adminGlobal.secretEncrypted),
      tokenSource: "admin_global_integration"
    };
  }

  if (provider !== "ozon_market") {
    const adminSharedApify = await prisma.apiIntegration.findFirst({
      where: { provider: "ozon_market", user: { role: "admin" } },
      orderBy: { updatedAt: "desc" }
    });
    if (adminSharedApify?.secretEncrypted) {
      return {
        configured: true,
        token: decryptSecret(adminSharedApify.secretEncrypted),
        tokenSource: "admin_ozon_market_integration"
      };
    }
  }

  // 最后回落：环境变量
  const envToken = process.env.APIFY_TOKEN || "";
  return {
    configured: Boolean(envToken),
    token: envToken,
    tokenSource: envToken ? "env" : "missing"
  };
}

/**
 * 从 integration 的 publicConfig 读取 actorId，回落到环境变量和默认值。
 */
export async function getActorId(
  userId: string | undefined,
  provider: "source_1688" | "ozon_market",
  envKey: string,
  defaultActorId: string
): Promise<string> {
  if (userId) {
    const own = await prisma.apiIntegration.findUnique({
      where: { userId_provider: { userId, provider } }
    });
    const actorId = readPublicConfig(own?.publicConfig).actorId;
    if (actorId) return actorId;
  }
  const adminGlobal = await prisma.apiIntegration.findFirst({
    where: { provider, user: { role: "admin" } },
    orderBy: { updatedAt: "desc" }
  });
  const actorId = readPublicConfig(adminGlobal?.publicConfig).actorId;
  if (actorId) return actorId;

  return process.env[envKey] || defaultActorId;
}

type RunActorOptions = {
  userId?: string;
  provider?: "source_1688" | "ozon_market";
  actorId: string;
  input: Record<string, unknown>;
  /** 轮询超时，默认 30s。超时后读取已写入的 partial dataset 并 abort。 */
  timeoutMs?: number;
  /** 超时是否 abort run（节省 Apify 计费），默认 true。 */
  abortOnTimeout?: boolean;
  /** 启动失败时重试次数，默认 1。 */
  retries?: number;
  /** 轮询间隔，默认 2s。 */
  pollIntervalMs?: number;
  /** 日志标签，用于 console.info 区分来源。 */
  logTag?: string;
};

/**
 * 执行一次 Apify Actor run：
 * 1. 启动 run
 * 2. 轮询直到 SUCCEEDED / FAILED / ABORTED / TIMED-OUT 或超时
 * 3. 读取 dataset items（超时则读 partial）
 * 4. 超时且 abortOnTimeout 则 abort
 *
 * 启动 HTTP 非 2xx 时按 retries 重试。
 */
export async function runActor(options: RunActorOptions): Promise<ApifyRunResult> {
  const {
    userId,
    provider = "source_1688",
    actorId,
    input,
    timeoutMs = 30_000,
    abortOnTimeout = true,
    retries = 1,
    pollIntervalMs = 2_000,
    logTag = "apify"
  } = options;

  const t0 = Date.now();
  const config = await getApifyRuntimeConfig(userId, provider);
  if (!config.configured) {
    throw new ApifyNotConfiguredError();
  }

  const requestUrl = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorIdForPath(actorId))}/runs`;
  console.info(`[${logTag}_request]`, JSON.stringify({
    actorId,
    url: requestUrl,
    authorization: `Bearer ${maskToken(config.token)}`,
    tokenSource: config.tokenSource,
    input
  }));

  // ── 启动（带 retry）──
  let startResult = await fetchApifyJson(requestUrl, config.token, {
    method: "POST",
    body: JSON.stringify(input)
  });
  let attempt = 0;
  while (!startResult.response.ok && attempt < retries) {
    attempt += 1;
    console.info(`[${logTag}_start_retry]`, JSON.stringify({ attempt, status: startResult.response.status }));
    await sleep(1_500);
    startResult = await fetchApifyJson(requestUrl, config.token, {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  if (!startResult.response.ok) {
    throw new ApifyActorError(
      startResult.text.slice(0, 800) || `Apify start HTTP ${startResult.response.status}`
    );
  }

  let run = asRun(startResult.json);
  if (!run.id) {
    throw new ApifyActorError("Apify 已响应，但没有返回 Run ID。");
  }
  const runId = run.id;

  // ── 轮询 ──
  const deadline = Date.now() + timeoutMs;
  let pollCount = 0;
  while (!FINAL_RUN_STATUSES.has(run.status || "") && Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const pollResult = await fetchApifyJson(
      `${APIFY_BASE_URL}/actor-runs/${encodeURIComponent(runId)}`,
      config.token
    );
    pollCount += 1;
    if (!pollResult.response.ok) {
      throw new ApifyActorError(
        pollResult.text.slice(0, 800) || `Apify poll HTTP ${pollResult.response.status}`,
        run.status,
        runId
      );
    }
    run = asRun(pollResult.json);
  }

  const timedOut = !FINAL_RUN_STATUSES.has(run.status || "");

  // ── 读取 dataset（完成则读最终，超时则读 partial）──
  let items: unknown[] = [];
  if (run.defaultDatasetId) {
    const datasetResult = await fetchApifyJson(
      `${APIFY_BASE_URL}/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?clean=true&format=json`,
      config.token
    );
    items = Array.isArray(datasetResult.json) ? datasetResult.json : [];
  }

  // ── 超时则 abort ──
  if (timedOut && abortOnTimeout) {
    await fetchApifyJson(
      `${APIFY_BASE_URL}/actor-runs/${encodeURIComponent(runId)}/abort`,
      config.token,
      { method: "POST" }
    );
  }

  const totalMs = Date.now() - t0;
  const finalStatus = run.status || (timedOut ? "TIMEOUT" : "UNKNOWN");
  console.info(`[${logTag}_done]`, JSON.stringify({
    actorId,
    runId,
    status: finalStatus,
    itemCount: items.length,
    pollCount,
    timedOut,
    totalMs
  }));

  return {
    items,
    runId,
    datasetId: run.defaultDatasetId,
    status: finalStatus,
    timedOut,
    totalMs
  };
}
