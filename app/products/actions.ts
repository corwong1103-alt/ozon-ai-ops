"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runBaseTranslationTask, runCreditAiTask } from "@/lib/services/ai";
import { uploadProductToOzon } from "@/lib/services/ozon";

const allowedSources = ["ozon", "source_1688", "manual"] as const;

export async function createProduct(formData: FormData) {
  const user = await requireApprovedUser();
  const source = String(formData.get("source") || "manual");
  const images = String(formData.get("images") || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const product = await prisma.product.create({
    data: {
      userId: user.id,
      source: allowedSources.includes(source as (typeof allowedSources)[number]) ? source as (typeof allowedSources)[number] : "manual",
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      price: Number(formData.get("price") || 0),
      images
    }
  });

  revalidatePath("/products");
  redirect(`/products/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const user = await requireApprovedUser();
  const images = String(formData.get("images") || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  await prisma.product.updateMany({
    where: { id: productId, userId: user.id },
    data: {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      price: Number(formData.get("price") || 0),
      images
    }
  });

  revalidatePath(`/products/${productId}`);
}

export async function translateProduct(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await runBaseTranslationTask({ userId: user.id, productId, message: `标题/描述翻译成俄文：${product.title}` });
  await prisma.product.update({ where: { id: productId }, data: { status: "translated" } });
  revalidatePath(`/products/${productId}`);
}

export async function translateImageText(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await runBaseTranslationTask({ userId: user.id, productId, message: `图片文字翻译成俄文：${product.title}` });
  revalidatePath(`/products/${productId}`);
}

export async function generateProductImage(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "image",
    message: `AI 商品图生成：${product.title}`,
    onSuccess: () => prisma.product.update({ where: { id: productId }, data: { status: "image_generated" } })
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/credits");
}

export async function generateProductVideo(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "video",
    message: `AI 视频生成：${product.title}`,
    onSuccess: () => prisma.product.update({ where: { id: productId }, data: { status: "video_generated" } })
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/credits");
}

export async function uploadProduct(productId: string, formData: FormData) {
  const user = await requireApprovedUser();
  const storeId = String(formData.get("storeId") || "");
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  const store = await prisma.store.findFirst({ where: { id: storeId, userId: user.id } });
  if (!product || !store) return;

  if (!product.title || !product.description || Number(product.price) <= 0) {
    await prisma.taskLog.create({
      data: { userId: user.id, productId, type: "upload", status: "failed", creditCost: 0, message: "商品信息不完整，上传失败。" }
    });
    revalidatePath(`/products/${productId}`);
    return;
  }

  const adapterResult = await uploadProductToOzon({ product, store });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      storeId: store.id,
      type: "upload",
      status: "queued",
      creditCost: 0,
      message: `上传到 Ozon mock adapter：${product.title}`,
      metadata: adapterResult
    }
  });
  await prisma.product.update({ where: { id: productId }, data: { storeId: store.id, status: "uploaded" } });
  revalidatePath(`/products/${productId}`);
}
