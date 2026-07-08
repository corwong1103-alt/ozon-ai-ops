import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOzonOrdersForImport, getOzonProductsForImport } from "@/lib/services/ozon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SyncMode = "products" | "orders";

const modes = new Set<SyncMode>(["products", "orders"]);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const body = await request.json();
  const mode = String(body.mode || "") as SyncMode;

  if (!modes.has(mode)) {
    return NextResponse.json({ error: "未知的 Ozon 同步类型。" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  });

  if (!store) {
    return NextResponse.json({ error: "店铺不存在或无权访问。" }, { status: 404 });
  }

  if (mode === "products") {
    const products = await getOzonProductsForImport(store, 30);
    let created = 0;
    let updated = 0;

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
        await prisma.product.update({
          where: { id: existing.id },
          data
        });
        updated += 1;
      } else {
        await prisma.product.create({ data });
        created += 1;
      }
    }

    await prisma.taskLog.create({
      data: {
        userId: user.id,
        storeId: store.id,
        type: "research",
        status: "success",
        creditCost: 0,
        message: `Ozon 商品同步完成：新增 ${created}，更新 ${updated}。`,
        metadata: {
          mode,
          total: products.length,
          created,
          updated,
          sample: products.slice(0, 5).map((item) => ({
            productId: item.productId,
            offerId: item.offerId,
            name: item.name,
            price: item.price,
            currency: item.currency,
            imageCount: item.images.length
          }))
        }
      }
    });

    return NextResponse.json({
      result: {
        ok: true,
        mode,
        total: products.length,
        created,
        updated,
        summary: `商品制作已同步：新增 ${created}，更新 ${updated}。`
      }
    });
  }

  const orders = await getOzonOrdersForImport(store, 30);
  let created = 0;
  let updated = 0;
  let orderItems = 0;

  for (const order of orders) {
    if (!order.postingNumber) continue;
    const existing = await prisma.order.findUnique({ where: { ozonOrderId: order.postingNumber } });
    const items = await Promise.all(order.items.map(async (item) => {
      const product = item.offerId
        ? await prisma.product.findFirst({
            where: {
              userId: user.id,
              storeId: store.id,
              offerId: item.offerId
            },
            select: { id: true }
          })
        : null;
      return {
        productId: product?.id,
        skuId: item.skuId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.price
      };
    }));

    await prisma.order.upsert({
      where: { ozonOrderId: order.postingNumber },
      update: {
        status: order.status || "pending",
        totalAmount: order.totalAmount,
        currency: order.currency,
        trackingNo: order.postingNumber,
        items: {
          deleteMany: {},
          create: items
        }
      },
      create: {
        storeId: store.id,
        ozonOrderId: order.postingNumber,
        status: order.status || "pending",
        totalAmount: order.totalAmount,
        currency: order.currency,
        trackingNo: order.postingNumber,
        items: {
          create: items
        }
      }
    });

    if (existing) updated += 1;
    else created += 1;
    orderItems += items.length;
  }

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      storeId: store.id,
      type: "collect",
      status: "success",
      creditCost: 0,
      message: orders.length ? `Ozon 订单同步完成：近 30 天 ${orders.length} 条。` : "Ozon 订单同步完成：近 30 天暂无 FBS 订单。",
      metadata: {
        mode,
        total: orders.length,
        created,
        updated,
        orderItems,
        sample: orders.slice(0, 10)
      }
    }
  });

  return NextResponse.json({
    result: {
      ok: true,
      mode,
      total: orders.length,
      created,
      updated,
      summary: orders.length ? `订单已同步：新增 ${created}，更新 ${updated}，明细 ${orderItems} 条。` : "近 30 天暂无 FBS 订单，已写入任务记录。"
    }
  });
}
