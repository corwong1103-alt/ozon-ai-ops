import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runBaseTranslationTask } from "@/lib/services/ai";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: params.id, userId: user.id } });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  const task = await runBaseTranslationTask({
    userId: user.id,
    productId: product.id,
    message: `图片文字翻译成俄文：${product.title}`
  });

  return NextResponse.json({ task });
}
