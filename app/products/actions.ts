"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai/provider";
import {
  deleteProductImage,
  imageList,
  parseProductImageUrls,
  moveProductImage,
  moveProductImageTo,
  replaceProductImage,
  type ImageMoveDirection
} from "@/lib/product-images";
import {
  buildImageTextTranslationPrompt,
  buildProductImagePrompt,
  buildProductTranslationPrompt
} from "@/lib/ai/prompts";
import { runBaseTranslationTask, runCreditAiTask } from "@/lib/services/ai";
import { uploadProductToOzon } from "@/lib/services/ozon";

const allowedSources = ["ozon", "source_1688", "manual"] as const;

export async function createProduct(formData: FormData) {
  const user = await requireApprovedUser();
  const source = String(formData.get("source") || "manual");
  const images = parseProductImageUrls(formData.get("images"));

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
  const images = parseProductImageUrls(formData.get("images"));

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
  return {
    ok: true,
    message: "商品信息已保存。"
  };
}

export async function removeProductImage(productId: string, index: number) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法翻译。" };

  await prisma.product.update({
    where: { id: product.id },
    data: { images: deleteProductImage(imageList(product.images), index) }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function replaceProductImageUrl(productId: string, index: number, formData: FormData) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await prisma.product.update({
    where: { id: product.id },
    data: { images: replaceProductImage(imageList(product.images), index, formData.get("imageUrl")) }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function reorderProductImage(productId: string, index: number, direction: ImageMoveDirection) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await prisma.product.update({
    where: { id: product.id },
    data: { images: moveProductImage(imageList(product.images), index, direction) }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function reorderProductImageTo(productId: string, fromIndex: number, toIndex: number) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  await prisma.product.update({
    where: { id: product.id },
    data: { images: moveProductImageTo(imageList(product.images), fromIndex, toIndex) }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}

export async function translateProduct(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return;

  const translated = await generateText({
    userId: user.id,
    messages: [
      { role: "system", content: "你输出简洁、可直接落库的商品本地化结果。" },
      { role: "user", content: buildProductTranslationPrompt({
        title: product.title,
        description: product.description,
        price: product.price.toString()
      }) }
    ]
  });

  await runBaseTranslationTask({
    userId: user.id,
    productId,
    message: `标题/描述翻译成俄文：${product.title}`,
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      type: "translate",
      status: "success",
      creditCost: 0,
      message: "百炼翻译结果已生成",
      metadata: { translated }
    }
  });
  await prisma.product.update({ where: { id: productId }, data: { status: "translated" } });
  revalidatePath(`/products/${productId}`);
  return {
    ok: true,
    message: "标题/描述俄文翻译已生成。"
  };
}

export async function translateImageText(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法翻译图片文字。" };

  const translated = await generateText({
    userId: user.id,
    messages: [
      { role: "system", content: "你输出商品图俄语短文案。" },
      { role: "user", content: buildImageTextTranslationPrompt({
        title: product.title,
        description: product.description,
        price: product.price.toString()
      }) }
    ]
  });

  await runBaseTranslationTask({ userId: user.id, productId, message: `图片文字翻译成俄文：${product.title}` });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      type: "translate",
      status: "success",
      creditCost: 0,
      message: "百炼图片文字翻译结果已生成",
      metadata: { translated }
    }
  });
  revalidatePath(`/products/${productId}`);
  return {
    ok: true,
    message: "图片文字俄文文案已生成。"
  };
}

export async function generateProductImage(productId: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法生成 AI 商品图。" };

  const task = await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "image",
    message: `AI 商品图生成：${product.title}`,
    prompt: buildProductImagePrompt({
      title: product.title,
      description: product.description,
      price: product.price.toString()
    }),
    onSuccess: () => prisma.product.update({ where: { id: productId }, data: { status: "image_generated" } })
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/credits");
  return {
    ok: task.status === "success",
    message: task.status === "success" ? "AI 商品图任务已完成。" : task.message
  };
}

export async function generateProductImageFromPrompt(productId: string, prompt: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法生成 AI 商品图。" };

  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 12) {
    return { ok: false, message: "请先填写更完整的生图提示词。" };
  }

  const task = await runCreditAiTask({
    userId: user.id,
    productId,
    kind: "image",
    message: `AI 商品图按提示词生成：${product.title}`,
    prompt: cleanPrompt,
    onSuccess: () => prisma.product.update({ where: { id: productId }, data: { status: "image_generated" } })
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/credits");
  return {
    ok: task.status === "success",
    message: task.status === "success" ? "AI 商品图已按提示词生成。" : task.message
  };
}

export async function inferImagePromptFromProduct(productId: string, referenceImageUrl?: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法反推提示词。" };

  const productImages = imageList(product.images);
  const referenceImages = referenceImageUrl && productImages.includes(referenceImageUrl)
    ? [referenceImageUrl]
    : productImages.slice(0, 3);
  const prompt = await generateText({
    userId: user.id,
    messages: [
      {
        role: "system",
        content: "你是电商商品图提示词工程师。根据商品信息和参考图链接，生成可用于 AI 生图的中文提示词，强调构图、背景、光线、材质、卖点和禁止事项。"
      },
      {
        role: "user",
        content: [
          `商品标题：${product.title}`,
          `商品描述：${product.description}`,
          `价格：${product.price}`,
          `参考原图链接：${referenceImages.join("\n") || "暂无"}`,
          "请输出一段可直接用于商品图生成的提示词，不要输出解释。"
        ].join("\n")
      }
    ],
    temperature: 0.25
  });

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId,
      type: "image",
      status: "success",
      creditCost: 0,
      message: "已根据原商品信息反推 AI 生图提示词。",
      metadata: { inferredPrompt: prompt, referenceImages }
    }
  });
  revalidatePath(`/products/${productId}`);
  return {
    ok: true,
    message: "已反推提示词，可编辑后生图。",
    prompt
  };
}

export async function generateProductVideo(productId: string) {
  void productId;
  return {
    ok: false,
    message: "AI 视频本轮先不测试，已按要求暂停。"
  };
}

export async function addGeneratedImageToProduct(productId: string, imageUrl: string) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，无法加入图片。" };

  const [url] = parseProductImageUrls([imageUrl]);
  if (!url) return { ok: false, message: "图片链接无效，无法加入商品图。" };

  const currentImages = imageList(product.images);
  if (currentImages.includes(url)) {
    return { ok: false, message: "这张 AI 图已经在商品图片墙里。" };
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      images: [url, ...currentImages],
      status: "image_generated"
    }
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId: product.id,
      type: "image",
      status: "success",
      creditCost: 0,
      message: "已将 AI 生成图加入商品图片墙。"
    }
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { ok: true, message: "AI 生成图已加入商品图片墙。" };
}

export async function uploadProduct(productId: string, formData: FormData) {
  const user = await requireApprovedUser();
  const storeId = String(formData.get("storeId") || "");
  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  const store = await prisma.store.findFirst({ where: { id: storeId, userId: user.id } });
  if (!product || !store) {
    return {
      ok: false,
      message: "未找到商品或店铺，无法上传。"
    };
  }

  if (!product.title || !product.description || Number(product.price) <= 0) {
    await prisma.taskLog.create({
      data: { userId: user.id, productId, type: "upload", status: "failed", creditCost: 0, message: "商品信息不完整，上传失败。" }
    });
    revalidatePath(`/products/${productId}`);
    return {
      ok: false,
      message: "商品信息不完整，上传失败。"
    };
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
  return {
    ok: true,
    message: "模拟上传到 Ozon 已完成。"
  };
}
