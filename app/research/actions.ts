"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OzonMarketProduct } from "@/lib/services/ozon-market";
import { getOzonProductsForImport, type OzonProductImport } from "@/lib/services/ozon";

function ozonProductDescription(product: OzonProductImport) {
  return [
    `Ozon Product ID: ${product.productId}`,
    `Offer ID: ${product.offerId}`,
    `Currency: ${product.currency}`,
    product.archived ? "Archived: yes" : "Archived: no",
    "Image source: Ozon Seller API /v3/product/info/list"
  ].join("\n");
}

export async function addOzonProductToPool(productId: string, storeId: string) {
  const user = await requireApprovedUser();
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId: user.id
    }
  });

  if (!store) {
    return {
      ok: false,
      message: "入池失败：没有找到当前 Ozon 店铺，请先确认店铺绑定状态。"
    };
  }

  const products = await getOzonProductsForImport(store, 50);
  const ozonProduct = products.find((product) => String(product.productId) === productId);

  if (!ozonProduct) {
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        storeId: store.id,
        type: "research",
        status: "failed",
        creditCost: 0,
        message: `Ozon 商品入池失败：API 未返回 Product ID ${productId}。`
      }
    });
    revalidatePath("/tasks");
    return {
      ok: false,
      message: `入池失败：Ozon API 未返回 Product ID ${productId}，请刷新调研结果后再试。`
    };
  }

  const existing = await prisma.product.findFirst({
    where: {
      userId: user.id,
      storeId: store.id,
      source: "ozon",
      description: {
        contains: `Ozon Product ID: ${ozonProduct.productId}`
      }
    }
  });
  const data = {
    userId: user.id,
    storeId: store.id,
    source: "ozon" as const,
    sourceProductId: String(ozonProduct.productId),
    offerId: ozonProduct.offerId,
    currency: ozonProduct.currency || "RUB",
    title: ozonProduct.name,
    description: ozonProductDescription(ozonProduct),
    price: ozonProduct.price,
    images: ozonProduct.images,
    status: "in_product_center" as const
  };
  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data });

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      storeId: store.id,
      productId: product.id,
      type: "research",
      status: "success",
      creditCost: 0,
      message: `已将 Ozon 真实商品加入商品制作：${ozonProduct.name}`,
      metadata: {
        source: "ozon_seller_api",
        endpoint: "/v3/product/info/list",
        productId: ozonProduct.productId,
        offerId: ozonProduct.offerId,
        imageCount: ozonProduct.images.length
      }
    }
  });

  revalidatePath("/products");
  revalidatePath("/research/ozon");
  revalidatePath("/dashboard");

  return {
    ok: true,
    productId: product.id,
    addedCount: 1,
    message: existing
      ? "已加入商品制作"
      : "已加入商品制作"
  };
}

function ozonMarketProductDescription(product: OzonMarketProduct) {
  return [
    `Ozon Market Product ID: ${product.externalId}`,
    product.productUrl ? `Source URL: ${product.productUrl}` : "",
    product.category ? `Category: ${product.category}` : "",
    product.seller ? `Seller: ${product.seller}` : "",
    product.rating ? `Rating: ${product.rating}` : "",
    product.reviewCount ? `Reviews: ${product.reviewCount}` : "",
    "Source: Apify Ozon Market",
    "Image source: Apify returned real Ozon image links"
  ].filter(Boolean).join("\n");
}

export async function addOzonMarketProductToPool(product: OzonMarketProduct, researchKeyword = "") {
  const user = await requireApprovedUser();

  if (!product.externalId || !product.title) {
    return {
      ok: false,
      message: "入池失败：市场数据源没有返回商品 ID 或标题。"
    };
  }

  const images = product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [];
  if (!images.length) {
    return {
      ok: false,
      message: "加入失败：这个市场商品没有真实图片链接，不能进入商品制作。"
    };
  }

  const existing = await prisma.product.findFirst({
    where: {
      userId: user.id,
      source: "ozon_market",
      description: {
        contains: `Ozon Market Product ID: ${product.externalId}`
      }
    }
  });
  const data = {
    userId: user.id,
    source: "ozon_market" as const,
    sourceProductId: product.externalId,
    offerId: product.externalId,
    researchKeyword: researchKeyword.trim() || null,
    currency: "RUB",
    title: product.title,
    description: ozonMarketProductDescription(product),
    price: product.price ?? 0,
    images,
    status: "in_product_center" as const
  };
  const pooledProduct = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data });

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId: pooledProduct.id,
      type: "research",
      status: "success",
      creditCost: 0,
      message: `已将 Ozon 市场商品加入商品制作：${product.title}`,
      metadata: {
        source: "apify_ozon_market",
        externalId: product.externalId,
        productUrl: product.productUrl,
        imageCount: images.length,
        rating: product.rating,
        reviewCount: product.reviewCount,
        seller: product.seller
      }
    }
  });

  revalidatePath("/products");
  revalidatePath("/research/ozon");
  revalidatePath("/dashboard");

  return {
    ok: true,
    productId: pooledProduct.id,
    addedCount: 1,
    message: existing
      ? "已加入商品制作"
      : "已加入商品制作"
  };
}
