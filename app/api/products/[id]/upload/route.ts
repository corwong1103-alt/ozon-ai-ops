import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadProductToOzon } from "@/lib/services/ozon";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const body = await request.json();
  const product = await prisma.product.findFirst({ where: { id: params.id, userId: user.id } });
  const store = await prisma.store.findFirst({ where: { id: String(body.storeId || ""), userId: user.id } });

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  if (!store) {
    const task = await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: product.id,
        type: "upload",
        status: "failed",
        creditCost: 0,
        message: "未绑定或未选择 Ozon 店铺，上传失败。"
      }
    });
    return NextResponse.json({ error: "请先绑定并选择 Ozon 跨境店铺。", task }, { status: 400 });
  }

  if (!product.title || !product.description || Number(product.price) <= 0) {
    const task = await prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: product.id,
        storeId: store.id,
        type: "upload",
        status: "failed",
        creditCost: 0,
        message: "商品信息不完整，上传失败。"
      }
    });
    return NextResponse.json({ error: "商品信息不完整，无法上传到 Ozon。", task }, { status: 400 });
  }

  const adapterResult = await uploadProductToOzon({ store, product });

  const [task] = await prisma.$transaction([
    prisma.taskLog.create({
      data: {
        userId: user.id,
        productId: product.id,
        storeId: store.id,
        type: "upload",
        status: "queued",
        creditCost: 0,
        message: `上传任务已创建：${product.title} -> ${store.name}`,
        metadata: adapterResult
      }
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { storeId: store.id, status: "uploaded" }
    })
  ]);

  return NextResponse.json({ task });
}
