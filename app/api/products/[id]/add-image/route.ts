import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({ where: { id: params.id, userId: user.id } });
  if (!product) return NextResponse.json({ error: "商品不存在。" }, { status: 404 });

  const body = await request.json();
  const imageUrl = String(body.imageUrl || "").trim();
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json({ error: "无效的图片 URL。" }, { status: 400 });
  }

  const current = imageList(product.images);
  if (current.includes(imageUrl)) {
    return NextResponse.json({ ok: true, message: "图片已存在。" });
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { images: [imageUrl, ...current] }
  });

  return NextResponse.json({ ok: true, imageCount: current.length + 1 });
}
