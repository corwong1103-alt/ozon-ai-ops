"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runCreditAiTask } from "@/lib/services/ai";

const platforms = ["tiktok", "instagram", "vk"] as const;

export async function toggleSocialAccount(platform: string) {
  const user = await requireApprovedUser();
  if (!platforms.includes(platform as (typeof platforms)[number])) return;
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
}

export async function createSocialCopy(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return;

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  const content = `标题：Ozon 热卖精选｜${product.title}\n文案：${product.description}\nHashtag：#ozon #crossborder #russiashop`;
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
}

export async function publishSocialImage(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return;

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

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
}

export async function publishSocialVideo(formData: FormData) {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as (typeof platforms)[number];
  if (!platforms.includes(platform)) return;

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  const task = await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "video",
    message: `社媒 AI 视频生成：${platform} / ${product.title}`
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
}
