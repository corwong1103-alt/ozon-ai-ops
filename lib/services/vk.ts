import "server-only";

import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const VK_API_VERSION = "5.199";
const VK_API_BASE = "https://api.vk.com/method";

export type VkPublishResult = {
  mode: "dry-run" | "real" | "blocked";
  postId?: number | string;
  error?: string;
  raw?: unknown;
};

/**
 * 发布到 VK（wall.post）。
 * 默认 dry-run（不真实发布）。VK_REAL_PUBLISH=true 时调真实 API。
 * 需要 VK integration 的 access_token（secretEncrypted）+ ownerId（publicConfig）。
 */
export async function publishToVk(input: {
  userId: string;
  message: string;
}): Promise<VkPublishResult> {
  const integration = await prisma.apiIntegration.findFirst({
    where: { userId: input.userId, provider: "vk" }
  });

  if (!integration?.secretEncrypted) {
    return { mode: "blocked", error: "未配置 VK access_token，请到集成中心保存。" };
  }

  const token = decryptSecret(integration.secretEncrypted);
  const publicConfig = (integration.publicConfig as Record<string, unknown> | null) || {};
  const ownerId = String(publicConfig.ownerId || publicConfig.owner_id || "");

  if (!ownerId) {
    return { mode: "blocked", error: "未配置 VK owner_id（用户或群组 ID）。" };
  }

  // dry-run 默认
  if (process.env.VK_REAL_PUBLISH !== "true") {
    return {
      mode: "dry-run",
      postId: `dryrun_${Date.now()}`,
      error: undefined
    };
  }

  try {
    const url = `${VK_API_BASE}/wall.post`;
    const params = new URLSearchParams({
      owner_id: ownerId,
      message: input.message,
      access_token: token,
      v: VK_API_VERSION,
      from_group: publicConfig.groupMode ? "1" : "0"
    });
    const resp = await fetch(`${url}?${params}`, { method: "POST" });
    const data = await resp.json() as { error?: { error_msg?: string }; response?: { post_id?: number } };

    if (data.error) {
      return { mode: "real", error: data.error.error_msg || "VK API 错误" };
    }
    return { mode: "real", postId: data.response?.post_id, raw: data };
  } catch (error) {
    return { mode: "real", error: error instanceof Error ? error.message : "VK API 调用失败" };
  }
}
