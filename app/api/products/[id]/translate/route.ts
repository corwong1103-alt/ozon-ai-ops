import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai/provider";
import { buildProductTranslationPrompt } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseTranslation(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
    }
  }
  return {
    titleRu: typeof parsed?.titleRu === "string" ? parsed.titleRu.trim() : "",
    descriptionRu: typeof parsed?.descriptionRu === "string" ? parsed.descriptionRu.trim() : ""
  };
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  const translated = await generateText({
    userId: user.id,
    messages: [
      { role: "system", content: "你是 Ozon 俄罗斯跨境电商商品本地化助手。严格输出 JSON，字段 titleRu、descriptionRu，不要输出其他内容。" },
      { role: "user", content: buildProductTranslationPrompt({
        title: product.title,
        description: product.description,
        price: product.price.toString()
      }) }
    ]
  });

  const { titleRu, descriptionRu } = parseTranslation(translated);

  await prisma.product.update({
    where: { id: product.id },
    data: {
      title: titleRu || product.title,
      description: descriptionRu || product.description,
      status: "optimizing"
    }
  });

  const task = await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId: product.id,
      type: "translate",
      status: "success",
      creditCost: 0,
      message: `百炼翻译完成：${titleRu || product.title}`,
      metadata: { translated, titleRu, descriptionRu }
    }
  });

  return NextResponse.json({
    ok: true,
    task,
    titleBefore: product.title,
    titleAfter: titleRu || product.title,
    message: "标题/描述俄文翻译已生成。"
  });
}
