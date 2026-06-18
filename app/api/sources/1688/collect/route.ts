import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  collect1688ProductByLink,
  source1688RawData
} from "@/lib/services/source-1688-openapi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await requireApprovedUser();

  let productUrl = "";
  try {
    const body = await request.json();
    productUrl = String(body?.productUrl || "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误，需要 JSON。" }, { status: 400 });
  }

  if (!productUrl) {
    return NextResponse.json({ success: false, error: "productUrl 不能为空。" }, { status: 400 });
  }

  try {
    const product = await collect1688ProductByLink({ userId: user.id, productUrl });
    const sourceProduct = await prisma.sourceProduct.upsert({
      where: {
        source_sourceProductId: { source: "1688", sourceProductId: product.id }
      },
      create: {
        source: "1688",
        sourceProductId: product.id,
        title: product.title,
        image: product.image || null,
        images: product.images,
        price: product.price || undefined,
        currency: "CNY",
        supplier: product.supplier || null,
        supplierLevel: product.supplierLevel || null,
        sales: product.sales || 0,
        rating: product.rating || undefined,
        productUrl: product.productUrl || productUrl,
        rawData: source1688RawData(product)
      },
      update: {
        title: product.title,
        image: product.image || null,
        images: product.images,
        price: product.price || undefined,
        supplier: product.supplier || null,
        supplierLevel: product.supplierLevel || null,
        sales: product.sales || 0,
        rating: product.rating || undefined,
        productUrl: product.productUrl || productUrl,
        rawData: source1688RawData(product)
      }
    });

    await prisma.apiIntegration.updateMany({
      where: { userId: user.id, provider: "source_1688" },
      data: {
        status: "configured",
        lastCheckedAt: new Date(),
        lastMessage: "1688 OpenAPI 商品链接采集成功。"
      }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "collect",
        status: "success",
        creditCost: 0,
        message: "1688 OpenAPI 商品采集成功：" + product.title.slice(0, 60),
        metadata: {
          sourceProductId: sourceProduct.id,
          offerId: product.id,
          sku: product.sku,
          attributes: product.attributes
        }
      }
    });

    return NextResponse.json({
      success: true,
      sourceProductId: sourceProduct.id,
      product: {
        id: product.id,
        title: product.title,
        image: product.image,
        sku: product.sku,
        skus: product.skus,
        price: product.price,
        attributes: product.attributes,
        productUrl: product.productUrl
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "1688 OpenAPI 采集失败。";
    const code = (error as { code?: string })?.code;
    await prisma.apiIntegration.updateMany({
      where: { userId: user.id, provider: "source_1688" },
      data: {
        status: "error",
        lastCheckedAt: new Date(),
        lastMessage: message.slice(0, 500)
      }
    }).catch(() => undefined);
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "collect",
        status: "failed",
        creditCost: 0,
        message: "1688 OpenAPI 商品采集失败：" + message.slice(0, 120)
      }
    }).catch(() => undefined);
    return NextResponse.json({ success: false, error: message, code }, { status: code === "SOURCE_1688_NOT_CONFIGURED" ? 412 : 500 });
  }
}
