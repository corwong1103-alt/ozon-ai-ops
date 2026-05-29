import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runCreditAiTask } from "@/lib/services/ai";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: params.id, userId: user.id } });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  const task = await runCreditAiTask({
    userId: user.id,
    productId: product.id,
    kind: "video",
    message: `AI 视频生成完成：${product.title}`,
    onSuccess: () => prisma.product.update({
      where: { id: product.id },
      data: { status: "video_generated" }
    })
  });

  return NextResponse.json({ task });
}
