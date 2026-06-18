"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { generateText } from "@/lib/ai/provider";
import {
  getIntegrationDefinition,
  getDashscopeRuntimeConfig,
  isIntegrationProvider,
  normalizePublicConfig,
  upsertIntegration
} from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { testOzonMarketConnection } from "@/lib/services/ozon-market";

const socialProviders = ["vk", "wibus"] as const;

export async function saveIntegration(provider: string, formData: FormData) {
  const user = await requireApprovedUser();
  if (!isIntegrationProvider(provider)) {
    return {
      ok: false,
      message: "保存失败：未知的 API 类型。"
    };
  }

  const definition = getIntegrationDefinition(provider);
  const accountLabel = String(formData.get("accountLabel") || definition?.shortName || "").trim();
  const secret = String(formData.get("secret") || "").trim();
  const publicConfig = normalizePublicConfig(provider, formData);

  const integration = await upsertIntegration({
    userId: user.id,
    provider,
    accountLabel,
    publicConfig,
    secret
  });

  if (socialProviders.includes(provider as (typeof socialProviders)[number])) {
    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: provider as (typeof socialProviders)[number] } },
      update: {
        status: integration.secretEncrypted ? "connected" : "disconnected",
        accountName: accountLabel || provider
      },
      create: {
        userId: user.id,
        platform: provider as (typeof socialProviders)[number],
        status: integration.secretEncrypted ? "connected" : "disconnected",
        accountName: accountLabel || provider
      }
    });
  }

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      type: provider === "dashscope" ? "translate" : provider === "source_1688" ? "collect" : "social_post",
      status: integration.secretEncrypted ? "success" : "queued",
      creditCost: 0,
      message: `${definition?.shortName || provider} API 配置已保存。`
    }
  });

  revalidatePath("/integrations");
  revalidatePath("/research/ozon");
  revalidatePath("/dashboard");
  revalidatePath("/credits");
  revalidatePath("/social");

  return {
    ok: true,
    message: `${definition?.shortName || provider} API 配置已保存。`
  };
}

export async function testDashscopeIntegration() {
  const user = await requireApprovedUser();

  try {
    const config = await getDashscopeRuntimeConfig(user.id);
    if (!config.apiKey) {
      throw new Error("请先保存真实 DashScope API Key，再测试百炼连通性。");
    }

    const content = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: "你是 API 连通性测试助手，只输出简短中文。" },
        { role: "user", content: "请回复：百炼 API 已连通。" }
      ],
      temperature: 0
    });

    await prisma.apiIntegration.update({
      where: { userId_provider: { userId: user.id, provider: "dashscope" } },
      data: {
        status: "configured",
        lastCheckedAt: new Date(),
        lastMessage: content.slice(0, 160)
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "translate",
        status: "success",
        creditCost: 0,
        message: "百炼 API 连通性测试通过。"
      }
    });
    revalidatePath("/integrations");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: "百炼 API 连通性测试通过。"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 220) : "百炼 API 测试失败。";
    await prisma.apiIntegration.updateMany({
      where: { userId: user.id, provider: "dashscope" },
      data: {
        status: "error",
        lastCheckedAt: new Date(),
        lastMessage: message
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "translate",
        status: "failed",
        creditCost: 0,
        message: "百炼 API 连通性测试失败，请检查 Key、模型和权限。"
      }
    });
    revalidatePath("/integrations");
    revalidatePath("/dashboard");
    return {
      ok: false,
      message: `百炼 API 连通性测试失败：${message}`
    };
  }
}

export async function testOzonMarketIntegration() {
  const user = await requireApprovedUser();

  try {
    const result = await testOzonMarketConnection(user.id);
    const debugText = JSON.stringify({
      request: "Apify Ozon Market backpack test",
      status: result.status,
      runId: result.runId,
      datasetId: result.datasetId,
      responseMs: result.responseMs,
      productCount: result.count,
      logs: result.logs
    }, null, 2);
    console.info("[ozon_market_apify_test]", debugText);

    if (!result.ok) {
      const message = result.status === "RUNNING"
        ? "Apify Actor 已启动，但 30 秒内仍在 RUNNING，已终止本次测试等待并尝试 abort。"
        : `Apify 已响应，但 backpack 没有返回商品。当前状态：${result.status || "UNKNOWN"}。`;
      await prisma.apiIntegration.updateMany({
        where: { userId: user.id, provider: "ozon_market" },
        data: {
          status: "error",
          lastCheckedAt: new Date(),
          lastMessage: `${message}\n${debugText}`.slice(0, 5000)
        }
      });
      await prisma.taskLog.create({
        data: {
          userId: user.id,
          type: "research",
          status: "failed",
          creditCost: 0,
          message: "Apify Ozon Market 测试未返回商品，已输出调试日志。"
        }
      });
      revalidatePath("/integrations");
      revalidatePath("/research/ozon");
      revalidatePath("/dashboard");
      return {
        ok: false,
        message,
        debug: debugText
      };
    }

    const message = result.status === "SUCCEEDED"
      ? `Apify Ozon Market 连接成功：backpack 返回 ${result.count} 个商品，响应 ${result.responseMs}ms。`
      : `Apify Ozon Market 已启动并返回部分数据：backpack 当前读到 ${result.count} 个商品，Actor 状态 ${result.status}，响应 ${result.responseMs}ms。`;
    await prisma.apiIntegration.update({
      where: { userId_provider: { userId: user.id, provider: "ozon_market" } },
      data: {
        status: "configured",
        lastCheckedAt: new Date(),
        lastMessage: `${message}\n${debugText}`.slice(0, 5000)
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "research",
        status: "success",
        creditCost: 0,
        message
      }
    });
    revalidatePath("/integrations");
    revalidatePath("/research/ozon");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message,
      debug: debugText
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 220) : "Apify Ozon Market 测试失败。";
    console.error("[ozon_market_apify_test_error]", message);
    await prisma.apiIntegration.updateMany({
      where: { userId: user.id, provider: "ozon_market" },
      data: {
        status: "error",
        lastCheckedAt: new Date(),
        lastMessage: message
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "research",
        status: "failed",
        creditCost: 0,
        message: "Apify Ozon Market 连通性测试失败，请检查 Token、Actor ID 和 Apify 账号额度。"
      }
    });
    revalidatePath("/integrations");
    revalidatePath("/research/ozon");
    revalidatePath("/dashboard");
    return {
      ok: false,
      message: `Apify Ozon Market 测试失败：${message}`,
      debug: JSON.stringify({
        request: "Apify Ozon Market backpack test",
        error: message
      }, null, 2)
    };
  }
}
