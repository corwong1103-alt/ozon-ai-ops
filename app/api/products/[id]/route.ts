import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const body = await request.json();

  const product = await prisma.product.updateMany({
    where: { id: params.id, userId: user.id },
    data: {
      title: String(body.title || ""),
      description: String(body.description || ""),
      price: Number(body.price || 0)
    }
  });

  if (product.count === 0) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
