import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseProductImageUrls } from "@/lib/product-images";
import type { Source1688Product } from "@/lib/apify/1688";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

/**
 * POST /api/sources/1688/import
 * Body: { product: Source1688Product }
 *
 * 流程：
 * 1. 写入/更新 SourceProduct（唯一约束 source + sourceProductId 防重复）
 * 2. 若该 SourceProduct 已被当前用户导入过，直接返回已有内部 Product
 * 3. 否则创建内部 Product（source=source_1688, status=in_product_center），回填 importedProductId
 */
export async function POST(request: Request) {
  const user = await requireApprovedUser();

  let product: Source1688Product | undefined;
  try {
    const body = await request.json();
    product = body?.product as Source1688Product | undefined;
  } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误，需要 JSON。" }, { status: 400 });
  }

  if (!product || !product.id || !product.title) {
    return NextResponse.json({ success: false, error: "product 字段不完整，至少需要 id 和 title。" }, { status: 400 });
  }

  const sourceKey = "1688";
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product.image
      ? [product.image]
      : [];

  try {
    // ── Step 1: upsert SourceProduct（唯一约束 source + sourceProductId 防重复）──
    const sourceProduct = await prisma.sourceProduct.upsert({
      where: {
        source_sourceProductId: { source: sourceKey, sourceProductId: String(product.id) }
      },
      create: {
        source: sourceKey,
        sourceProductId: String(product.id),
        title: product.title,
        image: product.image || null,
        images,
        price: product.price || undefined,
        currency: "CNY",
        supplier: product.supplier || null,
        supplierLevel: product.supplierLevel || null,
        sales: product.sales || 0,
        rating: product.rating || undefined,
        productUrl: product.productUrl || null,
        rawData: toPrismaJson(product.raw)
      },
      update: {
        // 已存在则刷新字段（用户重新搜索到同一商品时更新最新价格/销量）
        title: product.title,
        image: product.image || null,
        images,
        price: product.price || undefined,
        supplier: product.supplier || null,
        supplierLevel: product.supplierLevel || null,
        sales: product.sales || 0,
        rating: product.rating || undefined,
        productUrl: product.productUrl || null,
        rawData: toPrismaJson(product.raw)
      }
    });

    // ── Step 2: 已被当前用户导入过 → 直接返回已有内部 Product ──
    if (sourceProduct.importedBy === user.id && sourceProduct.importedProductId) {
      const existing = await prisma.product.findUnique({
        where: { id: sourceProduct.importedProductId }
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          imported: false,
          message: "该 1688 商品已导入，跳过重复创建。",
          sourceProductId: sourceProduct.id,
          productId: existing.id,
          product: existing
        });
      }
    }

    // ── Step 3: 创建内部 Product（source=source_1688, 初始 in_product_center）──
    const internalProduct = await prisma.product.create({
      data: {
        userId: user.id,
        source: "source_1688",
        sourceProductId: sourceProduct.sourceProductId,
        offerId: sourceProduct.sourceProductId,
        researchKeyword: sourceProduct.researchKeyword,
        title: sourceProduct.title,
        description: "",
        price: sourceProduct.price ?? 0,
        currency: sourceProduct.currency || "CNY",
        images: parseProductImageUrls(images.join("\n")),
        status: "in_product_center"
      }
    });

    // 回填 SourceProduct 导入标记
    await prisma.sourceProduct.update({
      where: { id: sourceProduct.id },
      data: {
        importedBy: user.id,
        importedProductId: internalProduct.id
      }
    });

    // 记录任务日志
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: internalProduct.id,
        type: "collect",
        status: "success",
        creditCost: 0,
        message: `从 1688 导入商品：${sourceProduct.title.slice(0, 60)}`,
        metadata: { source: sourceKey, sourceProductId: sourceProduct.sourceProductId, supplier: sourceProduct.supplier }
      }
    });

    return NextResponse.json({
      success: true,
      imported: true,
      message: "1688 商品已导入商品池。",
      sourceProductId: sourceProduct.id,
      productId: internalProduct.id,
      product: internalProduct
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "1688 导入失败。";
    console.error("[1688_import_error]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
