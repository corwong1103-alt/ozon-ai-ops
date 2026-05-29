"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMockProduct } from "@/lib/services/mock-market";

export async function addMockProductToPool(productId: string) {
  const user = await requireApprovedUser();
  const mockProduct = getMockProduct(productId);
  if (!mockProduct) return;

  const product = await prisma.product.create({
    data: {
      userId: user.id,
      source: mockProduct.source,
      title: mockProduct.title,
      description: mockProduct.description,
      price: mockProduct.price,
      images: mockProduct.images,
      status: "draft"
    }
  });

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      productId: product.id,
      type: mockProduct.source === "ozon" ? "research" : "collect",
      status: "success",
      creditCost: 0,
      message: `已将 mock 商品加入商品池：${mockProduct.title}`
    }
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
}
