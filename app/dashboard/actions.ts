"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOzonOrdersForImport, getOzonProductsForImport } from "@/lib/services/ozon";

const customerSamples = [
  { id: "mock_presale", customerName: "Anna K.", message: "这个保温杯适合送礼吗？", category: "presale" },
  { id: "mock_logistics", customerName: "Ivan P.", message: "物流超过预计时间了。", category: "logistics" },
  { id: "mock_refund", customerName: "Maria S.", message: "我想申请退款。", category: "refund" },
  { id: "mock_review", customerName: "Ozon Review", message: "出现一条差评提醒。", category: "review_alert" },
  { id: "mock_inventory", customerName: "Ozon Stock", message: "库存低于安全线。", category: "inventory_alert" }
] as const;

const socialPlatforms = ["vk", "wibus"] as const;

export async function prepareFullSiteTest() {
  const user = await requireApprovedUser();
  const store = await prisma.store.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  await prisma.aiCredits.upsert({
    where: { userId: user.id },
    update: {
      imageCredits: { increment: 5 },
      videoCredits: { increment: 3 }
    },
    create: {
      userId: user.id,
      imageCredits: 5,
      videoCredits: 3
    }
  });

  let productCreated = 0;
  let productUpdated = 0;
  let orderCount = 0;

  if (store) {
    const products = await getOzonProductsForImport(store, 30);

    for (const item of products) {
      const existing = await prisma.product.findFirst({
        where: {
          userId: user.id,
          storeId: store.id,
          source: "ozon",
          description: {
            contains: `Ozon Product ID: ${item.productId}`
          }
        }
      });

      const data = {
        userId: user.id,
        storeId: store.id,
        source: "ozon" as const,
        sourceProductId: String(item.productId),
        offerId: item.offerId,
        currency: item.currency || "RUB",
        title: item.name,
        description: [
          `Ozon Product ID: ${item.productId}`,
          `Offer ID: ${item.offerId}`,
          `Currency: ${item.currency}`,
          item.archived ? "Archived: yes" : "Archived: no",
          "Image source: Ozon Seller API /v3/product/info/list"
        ].join("\n"),
        price: item.price,
        images: item.images,
        status: "in_product_center" as const
      };

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        productUpdated += 1;
      } else {
        await prisma.product.create({ data });
        productCreated += 1;
      }
    }

    const orders = await getOzonOrdersForImport(store, 30);
    orderCount = orders.length;

    await prisma.taskLog.create({
      data: {
        userId: user.id,
        storeId: store.id,
        type: "collect",
        status: "success",
        creditCost: 0,
        message: orderCount ? `全站测试准备：同步近 30 天 Ozon 订单 ${orderCount} 条。` : "全站测试准备：近 30 天暂无 FBS 订单。",
        metadata: { mode: "orders", total: orderCount, sample: orders.slice(0, 10) }
      }
    });
  }

  for (const sample of customerSamples) {
    await prisma.customerMessage.upsert({
      where: { id: `${sample.id}_${user.id}` },
      update: {
        storeId: store?.id,
        status: sample.category.includes("alert") ? "alert" : "pending"
      },
      create: {
        id: `${sample.id}_${user.id}`,
        userId: user.id,
        storeId: store?.id,
        customerName: sample.customerName,
        message: sample.message,
        category: sample.category,
        status: sample.category.includes("alert") ? "alert" : "pending"
      }
    });
  }

  for (const platform of socialPlatforms) {
    await prisma.socialAccount.upsert({
      where: { userId_platform: { userId: user.id, platform } },
      update: {
        status: "connected",
        accountName: `@oecon_${platform}_test`
      },
      create: {
        userId: user.id,
        platform,
        status: "connected",
        accountName: `@oecon_${platform}_test`
      }
    });
  }

  const firstProduct = await prisma.product.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  if (firstProduct) {
    for (const platform of socialPlatforms) {
      await prisma.socialPost.create({
        data: {
          userId: user.id,
          productId: firstProduct.id,
          platform,
          content: `测试草稿：${firstProduct.title}`,
          mediaType: "image",
          status: "draft"
        }
      });
    }
  }

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      storeId: store?.id,
      type: "alert",
      status: "success",
      creditCost: 0,
      message: `全站测试准备完成：商品新增 ${productCreated} / 更新 ${productUpdated}，订单 ${orderCount}，客服 5 条，社媒账号 ${socialPlatforms.length} 个，AI 测试额度已补足。`,
      metadata: {
        productCreated,
        productUpdated,
        orderCount,
        customerMessages: customerSamples.length,
        socialAccounts: socialPlatforms.length,
        aiCreditsAdded: { image: 5, video: 3 }
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/stores");
  revalidatePath("/products");
  revalidatePath("/customer");
  revalidatePath("/social");
  revalidatePath("/credits");
  revalidatePath("/tasks");
}
