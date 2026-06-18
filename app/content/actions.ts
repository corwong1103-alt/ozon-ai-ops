"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { generateText } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { publishToVk } from "@/lib/services/vk";
import { isContentEligibleProduct } from "@/lib/product-main-flow";

// 从商品创建内容（V3：内容必须来自商品中心）
export async function createContentFromProduct(formData: FormData): Promise<void> {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const platform = String(formData.get("platform") || "vk") as "vk" | "wibus";
  const topic = String(formData.get("topic") || "caption");

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) { console.error("[content_create] product not found"); return; }
  if (!isContentEligibleProduct(product.status)) { console.error("[content_create] product not eligible"); return; }

  const platformName = platform === "vk" ? "VK" : "Wibes";
  const prompts: Record<string, string> = {
    title: `为 ${platformName} 生成俄语推广标题（≤50字符）：${product.title}`,
    caption: `为 ${platformName} 生成俄语推广文案（150-300字，含表情）：${product.title}。${product.description}`,
    tags: `为 ${platformName} 生成 8-12 个俄语标签（#开头空格分隔）：${product.title}`
  };

  try {
    const content = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: "你是俄罗斯社媒营销专家。" },
        { role: "user", content: prompts[topic] || prompts.caption }
      ],
      temperature: 0.7
    });

    await prisma.socialPost.create({
      data: { userId: user.id, productId, platform, content, mediaType: "image", status: "draft" }
    });
    await prisma.taskLog.create({
      data: { userId: user.id, productId, type: "social_post", status: "success", creditCost: 0, message: "已生成内容草稿，可提交审核。" }
    });
    revalidatePath("/content");
  } catch (error) {
    console.error("[content_create]", error instanceof Error ? error.message : error);
  }
}

// 状态流转：draft → pending_review → ready
export async function advanceContentStatus(formData: FormData): Promise<void> {
  const user = await requireApprovedUser();
  const postId = String(formData.get("postId") || "");
  const action = String(formData.get("action") || "");

  const post = await prisma.socialPost.findFirst({ where: { id: postId, userId: user.id } });
  if (!post) return;

  const transitions: Record<string, string> = {
    review: "pending_review",
    approve: "ready",
    reject: "draft"
  };
  const next = transitions[action];
  if (!next) return;

  await prisma.socialPost.update({ where: { id: postId }, data: { status: next as never } });
  revalidatePath("/content");
}

// 立即发布（ready → published/failed）
export async function publishContentNow(formData: FormData): Promise<void> {
  const user = await requireApprovedUser();
  const postId = String(formData.get("postId") || "");

  const post = await prisma.socialPost.findFirst({ where: { id: postId, userId: user.id } });
  if (!post || post.status !== "ready") return;

  if (post.platform === "vk") {
    const result = await publishToVk({ userId: user.id, message: post.content });
    const published = result.mode !== "blocked" && !result.error;
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: (published ? "published" : "failed") as never, publishedAt: published ? new Date() : null }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id, productId: post.productId, type: "social_publish",
        status: published ? "success" : "failed", creditCost: 0,
        message: `VK 发布 ${result.mode}：${result.error || `postId=${result.postId}`}`
      }
    });
  }
  revalidatePath("/content");
}

// 定时发布（ready → scheduled）
export async function scheduleContent(formData: FormData): Promise<void> {
  const user = await requireApprovedUser();
  const postId = String(formData.get("postId") || "");
  const scheduledAt = String(formData.get("scheduledAt") || "");

  const post = await prisma.socialPost.findFirst({ where: { id: postId, userId: user.id } });
  if (!post || post.status !== "ready") return;

  const when = new Date(scheduledAt);
  if (isNaN(when.getTime()) || when.getTime() < Date.now()) return;

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: "scheduled" as never, scheduledAt: when }
  });
  revalidatePath("/content");
}
