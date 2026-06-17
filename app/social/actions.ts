"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { generateText } from "@/lib/ai/provider";
import { buildProductVideoPrompt, buildSocialCopyPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { runCreditAiTask } from "@/lib/services/ai";

const platforms = ["vk", "wibus"] as const;

export async function toggleSocialAccount(platform: string) {
  const user = await requireApprovedUser();
  if (!platforms.includes(platform as (typeof platforms)[number])) {
    return { ok: false, message: "平台无效，仅支持 VK / Wibus。" };
  }
  const typedPlatform = platform as (typeof platforms)[number];
  const existing = await prisma.socialAccount.findUnique({
    where: { userId_platform: { userId: user.id, platform: typedPlatform } }
  });
  const nextStatus = existing?.status === "connected" ? "disconnected" : "connected";

  await prisma.socialAccount.upsert({
    where: { userId_platform: { userId: user.id, platform: typedPlatform } },
    update: {
      status: nextStatus,
      accountName: nextStatus === "connected" ? `@ozon_${typedPlatform}_mock` : null
    },
    create: {
      userId: user.id,
      platform: typedPlatform,
      status: "connected",
      accountName: `@ozon_${typedPlatform}_mock`
    }
  });

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      type: "social_post",
      status: "success",
      creditCost: 0,
      message: `${typedPlatform} 授权状态已更新为 ${nextStatus}`
    }
  });

  revalidatePath("/social");
  return {
    ok: true,
    message: `${typedPlatform.toUpperCase()} 已${nextStatus === "connected" ? "模拟授权" : "断开授权"}。`
  };
}

export async function createSocialCopy(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return { ok: false, message: "平台无效，仅支持 VK / Wibus。" };

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法生成社媒文案。" };

  const content = await generateText({
    userId: user.id,
    messages: [
      { role: "system", content: "你生成可直接发布的跨境电商社媒内容。" },
      { role: "user", content: buildSocialCopyPrompt({
        platform,
        product: {
          title: product.title,
          description: product.description,
          price: product.price.toString()
        }
      }) }
    ]
  });
  await prisma.socialPost.create({
    data: {
      userId: user.id,
      productId,
      platform,
      content,
      mediaType: "image",
      status: "draft"
    }
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      type: "social_post",
      status: "success",
      creditCost: 0,
      message: `已生成社媒文案：${product.title}`
    }
  });

  revalidatePath("/social");
  return {
    ok: true,
    message: `${platform.toUpperCase()} AI 文案已生成。`
  };
}

export async function publishSocialImage(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return { ok: false, message: "平台无效，仅支持 VK / Wibus。" };

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法发布图文。" };

  await prisma.socialPost.create({
    data: {
      userId: user.id,
      productId,
      platform,
      content: `图文发布 mock：${product.title}`,
      mediaType: "image",
      status: "published"
    }
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      type: "social_publish",
      status: "success",
      creditCost: 0,
      message: `社媒图文发布完成：${platform} / ${product.title}`
    }
  });

  revalidatePath("/social");
  return {
    ok: true,
    message: `${platform.toUpperCase()} 模拟图文发布已完成。`
  };
}

export async function publishSocialVideo(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return { ok: false, message: "平台无效，仅支持 VK / Wibus。" };

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法生成视频。" };

  const task = await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "video",
    message: `社媒 AI 视频生成：${platform} / ${product.title}`,
    prompt: buildProductVideoPrompt({
      title: product.title,
      description: product.description,
      price: product.price.toString()
    })
  });

  if (task.status === "success") {
    await prisma.socialPost.create({
      data: {
        userId: user.id,
        productId,
        platform,
        content: `AI 视频发布 mock：${product.title}`,
        mediaType: "video",
        status: "published"
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId,
        type: "social_publish",
        status: "success",
        creditCost: 0,
        message: `社媒 AI 视频发布完成：${platform} / ${product.title}`
      }
    });
  }

  revalidatePath("/social");
  revalidatePath("/credits");
  return {
    ok: task.status === "success",
    message: task.status === "success" ? `${platform.toUpperCase()} AI 视频任务已完成。` : task.message
  };
}
