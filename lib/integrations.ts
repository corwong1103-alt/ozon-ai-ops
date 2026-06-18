import "server-only";

import type { IntegrationProvider, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const integrationProviders = ["dashscope", "ozon_market", "source_1688", "vk", "wibus"] as const;

export type IntegrationProviderId = (typeof integrationProviders)[number];

type IntegrationDefinition = {
  provider: IntegrationProviderId;
  name: string;
  shortName: string;
  description: string;
  secretLabel: string;
  secretPlaceholder: string;
  help: string;
  fields: Array<{
    name: string;
    label: string;
    placeholder: string;
    required?: boolean;
  }>;
};

export const integrationDefinitions: IntegrationDefinition[] = [
  {
    provider: "dashscope",
    name: "阿里云百炼 / 通义千问",
    shortName: "百炼",
    description: "用于商品翻译、客服回复、社媒文案、AI 商品图和后续视频生成。",
    secretLabel: "DashScope API Key",
    secretPlaceholder: "sk-xxxxxxxx",
    help: "在阿里云百炼控制台创建 API Key 后填入。文本能力建议先用 qwen-plus，生图和视频模型按账号开通情况填写。",
    fields: [
      { name: "baseUrl", label: "Base URL", placeholder: "https://dashscope.aliyuncs.com/compatible-mode/v1", required: true },
      { name: "textModel", label: "文本模型", placeholder: "qwen-plus", required: true },
      { name: "fastModel", label: "快速模型", placeholder: "qwen-plus" },
      { name: "imageModel", label: "生图模型", placeholder: "qwen-image-2.0-pro" },
      { name: "imageSize", label: "图片尺寸", placeholder: "1024x1024" },
      { name: "videoEndpoint", label: "视频端点", placeholder: "/compatible-mode/v1/..." },
      { name: "videoModel", label: "视频模型", placeholder: "按百炼后台开通模型填写" }
    ]
  },
  {
    provider: "ozon_market",
    name: "Apify Ozon Market",
    shortName: "Apify Ozon",
    description: "用于真实搜索 Ozon 全站商品、类目商品和商品详情，并把结果加入商品池。",
    secretLabel: "Apify API Token",
    secretPlaceholder: "apify_api_xxxxxxxxxxxx",
    help: "在 Apify 账号 Settings / Integrations 中复制 API Token；Actor ID 默认使用 zen-studio/ozon-scraper-pro，可按实际购买的 Actor 修改。",
    fields: [
      { name: "actorId", label: "Actor ID", placeholder: "zen-studio/ozon-scraper-pro", required: true },
      { name: "maxItems", label: "默认搜索数量", placeholder: "20" }
    ]
  },
  {
    provider: "source_1688",
    name: "1688 / 阿里开放平台",
    shortName: "1688",
    description: "用于真实采集 1688 商品标题、价格、SKU 和商品主图链接。",
    secretLabel: "App Secret / Access Token",
    secretPlaceholder: "1688 开放平台密钥或授权 Token",
    help: "如果先做链接采集，可先填写 App Key 和采集模式；如果走开放平台 API，再补 App Secret/Token。",
    fields: [
      { name: "appKey", label: "App Key", placeholder: "开放平台 App Key" },
      { name: "apiBaseUrl", label: "API Base URL", placeholder: "https://gw.open.1688.com/openapi/..." },
      { name: "collectorMode", label: "采集模式", placeholder: "link / openapi", required: true },
      { name: "callbackUrl", label: "回调地址", placeholder: "https://你的域名/api/integrations/1688/callback" }
    ]
  },
  {
    provider: "vk",
    name: "VK 社媒发布",
    shortName: "VK",
    description: "用于后续真实发布 VK 图文内容，目前先保存应用凭证和访问令牌。",
    secretLabel: "VK Access Token",
    secretPlaceholder: "vk1.a.xxxxxxxx",
    help: "在 VK 开发者后台创建应用，配置回调地址，拿到 Access Token 后填入。",
    fields: [
      { name: "appId", label: "App ID", placeholder: "VK 应用 ID", required: true },
      { name: "groupId", label: "Group / Page ID", placeholder: "发布主页或社群 ID" },
      { name: "callbackUrl", label: "OAuth 回调地址", placeholder: "https://你的域名/api/social/vk/callback" },
      { name: "scope", label: "授权范围", placeholder: "wall,photos,offline" }
    ]
  },
  {
    provider: "wibus",
    name: "Wibus 社媒发布",
    shortName: "Wibus",
    description: "用于后续真实发布 Wibus 图文内容，目前先保存账号 API 凭证。",
    secretLabel: "Wibus API Key / Token",
    secretPlaceholder: "Wibus 平台提供的 API Key",
    help: "按 Wibus 后台提供的 API Key、账号 ID 和发布端点填写；后续真实发布会读取这里。",
    fields: [
      { name: "accountId", label: "账号 ID", placeholder: "Wibus account id", required: true },
      { name: "apiBaseUrl", label: "API Base URL", placeholder: "https://api.wibus.com/..." },
      { name: "callbackUrl", label: "回调地址", placeholder: "https://你的域名/api/social/wibus/callback" }
    ]
  }
];

export function getIntegrationDefinition(provider: string) {
  return integrationDefinitions.find((item) => item.provider === provider);
}

export function isIntegrationProvider(provider: string): provider is IntegrationProviderId {
  return integrationProviders.includes(provider as IntegrationProviderId);
}

export function normalizePublicConfig(provider: IntegrationProviderId, formData: FormData) {
  const definition = getIntegrationDefinition(provider);
  const config: Record<string, string> = {};
  for (const field of definition?.fields || []) {
    const value = String(formData.get(field.name) || "").trim();
    if (value) config[field.name] = value;
  }
  return config as Prisma.InputJsonObject;
}

export function readPublicConfig(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")])
  );
}

export async function upsertIntegration(input: {
  userId: string;
  provider: IntegrationProviderId;
  accountLabel?: string;
  publicConfig: Prisma.InputJsonObject;
  secret?: string;
}) {
  const existing = await prisma.apiIntegration.findUnique({
    where: { userId_provider: { userId: input.userId, provider: input.provider as IntegrationProvider } }
  });
  const secretEncrypted = input.secret ? encryptSecret(input.secret) : existing?.secretEncrypted;

  return prisma.apiIntegration.upsert({
    where: { userId_provider: { userId: input.userId, provider: input.provider as IntegrationProvider } },
    update: {
      accountLabel: input.accountLabel || existing?.accountLabel,
      publicConfig: input.publicConfig,
      secretEncrypted,
      status: secretEncrypted ? "configured" : "disconnected",
      lastCheckedAt: new Date(),
      lastMessage: secretEncrypted ? "配置已保存，等待真实接口测试。" : "已保存公开配置，密钥未填写。"
    },
    create: {
      userId: input.userId,
      provider: input.provider as IntegrationProvider,
      accountLabel: input.accountLabel,
      publicConfig: input.publicConfig,
      secretEncrypted,
      status: secretEncrypted ? "configured" : "disconnected",
      lastCheckedAt: new Date(),
      lastMessage: secretEncrypted ? "配置已保存，等待真实接口测试。" : "已保存公开配置，密钥未填写。"
    }
  });
}

export async function getIntegrationSecret(userId: string, provider: IntegrationProviderId) {
  const integration = await prisma.apiIntegration.findUnique({
    where: { userId_provider: { userId, provider: provider as IntegrationProvider } }
  });
  if (!integration?.secretEncrypted) return "";
  return decryptSecret(integration.secretEncrypted);
}

export async function getDashscopeRuntimeConfig(userId?: string) {
  const integration = userId
    ? await prisma.apiIntegration.findUnique({
        where: { userId_provider: { userId, provider: "dashscope" } }
      })
    : null;
  const adminIntegration = integration?.secretEncrypted
    ? null
    : await prisma.apiIntegration.findFirst({
        where: { provider: "dashscope", user: { role: "admin" } },
        orderBy: { updatedAt: "desc" }
      });
  const effectiveIntegration = integration?.secretEncrypted ? integration : adminIntegration;
  const publicConfig = readPublicConfig(effectiveIntegration?.publicConfig);
  const apiKey = effectiveIntegration?.secretEncrypted
    ? decryptSecret(effectiveIntegration.secretEncrypted)
    : process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY || "";

  return {
    enabled: Boolean(apiKey) || process.env.AI_PROVIDER === "dashscope",
    apiKey,
    baseUrl: publicConfig.baseUrl || process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    textModel: publicConfig.textModel || process.env.QWEN_TEXT_MODEL || "qwen-plus",
    fastModel: publicConfig.fastModel || process.env.QWEN_FAST_MODEL || publicConfig.textModel || process.env.QWEN_TEXT_MODEL || "qwen-plus",
    imageModel: publicConfig.imageModel || process.env.QWEN_IMAGE_MODEL || "qwen-image-2.0-pro",
    imageSize: publicConfig.imageSize || process.env.QWEN_IMAGE_SIZE || "1024x1024",
    videoEndpoint: publicConfig.videoEndpoint || process.env.DASHSCOPE_VIDEO_ENDPOINT || "",
    videoModel: publicConfig.videoModel || process.env.QWEN_VIDEO_MODEL || ""
  };
}

export function summarizeIntegration(input: {
  secretEncrypted?: string | null;
  status: string;
  publicConfig?: Prisma.JsonValue | null;
}) {
  return {
    configured: Boolean(input.secretEncrypted),
    status: input.status,
    secretPreview: input.secretEncrypted ? maskSecret("key-" + input.secretEncrypted.slice(-8)) : "未填写",
    publicConfig: readPublicConfig(input.publicConfig)
  };
}
