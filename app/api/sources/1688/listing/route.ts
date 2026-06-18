import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai/provider";
import { buildOzonListingPrompt, parseOzonListing, type OzonListing } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sources/1688/listing
 * Body: { productId: string }
 *
 * 基于已导入的内部 Product（source=source_1688）+ 关联的 SourceProduct 原始数据，
 * 调用百炼生成完整 Ozon Listing（俄文标题/描述/属性/SEO 关键词）。
 * 生成后写入 TaskLog metadata，不自动覆盖商品字段，由人工在详情页确认。
 */
export async function POST(request: Request) {
  const user = await requireApprovedUser();

  let productId = "";
  try {
    const body = await request.json();
    productId = String(body?.productId || "");
  } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误，需要 JSON。" }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ success: false, error: "productId 不能为空。" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: user.id }
  });
  if (!product) {
    return NextResponse.json({ success: false, error: "未找到商品。" }, { status: 404 });
  }

  // 取关联的 SourceProduct 原始数据（supplier / 销量 / 评分等补充上下文）
  let supplier = "";
  let extraContext = "";
  if (product.sourceProductId) {
    const sourceProduct = await prisma.sourceProduct.findUnique({
      where: {
        source_sourceProductId: {
          source: product.source === "source_1688" ? "1688" : product.source,
          sourceProductId: product.sourceProductId
        }
      }
    });
    if (sourceProduct) {
      supplier = sourceProduct.supplier || "";
      const raw = sourceProduct.rawData as Record<string, unknown> | null;
      const sales = sourceProduct.sales;
      const rating = sourceProduct.rating;
      extraContext = [
        sales ? `1688 月销量约 ${sales}` : "",
        rating ? `1688 评分 ${rating}` : "",
        raw?.desc ? `源描述补充：${String(raw.desc).slice(0, 300)}` : ""
      ].filter(Boolean).join("\n");
    }
  }

  try {
    const prompt = buildOzonListingPrompt({
      title: product.title,
      description: product.description,
      price: product.price.toString(),
      supplier,
      extraContext
    });

    const raw = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: "你是 Ozon 上架运营专家，只输出合法 JSON，不输出任何解释。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });

    const listing: OzonListing = parseOzonListing(raw);

    await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: product.id,
        type: "translate",
        status: "success",
        creditCost: 0,
        message: `1688 商品生成 Ozon Listing：${product.title.slice(0, 40)}`,
        metadata: { listing, rawPreview: raw.slice(0, 500) }
      }
    });

    return NextResponse.json({ success: true, productId, listing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listing 生成失败。";
    console.error("[1688_listing_error]", message);
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: product.id,
        type: "translate",
        status: "failed",
        creditCost: 0,
        message: `Ozon Listing 生成失败：${message.slice(0, 120)}`
      }
    }).catch(() => undefined);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
