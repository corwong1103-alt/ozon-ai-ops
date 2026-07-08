import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { buildMainImagePrompt, NEGATIVE_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { runCreditAiTask } from "@/lib/services/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const body = await request.json().catch(() => ({}));
  const product = await prisma.product.findFirst({ where: { id: params.id, userId: user.id } });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  const preset = buildMainImagePrompt({
    title: product.title,
    description: product.description,
    price: product.price.toString()
  });
  const referenceImage = String(body.referenceImage || "").trim() || undefined;
  const prompt = String(body.prompt || "").trim() || preset.prompt;
  const strength = Number.isFinite(Number(body.strength)) ? Number(body.strength) : preset.strength;
  const negativePrompt = String(body.negativePrompt || "").trim() || NEGATIVE_PROMPT;

  const task = await runCreditAiTask({
    userId: user.id,
    productId: product.id,
    kind: "image",
    message: `AI 商品图生成完成：${product.title}`,
    prompt,
    referenceImage,
    strength,
    negativePrompt,
    onSuccess: () => prisma.product.update({
      where: { id: product.id },
      data: { status: "optimizing" }
    })
  });

  return NextResponse.json({ task });
}
