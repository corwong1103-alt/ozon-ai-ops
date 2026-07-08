import "server-only";

import { prisma } from "@/lib/prisma";

function assertPositiveQuantity(qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("Inventory quantity must be a positive integer.");
  }
}

export async function reserveStock(skuId: string, qty: number) {
  assertPositiveQuantity(qty);
  const result = await prisma.inventory.updateMany({
    where: {
      skuId,
      available: { gte: qty }
    },
    data: {
      available: { decrement: qty },
      reserved: { increment: qty }
    }
  });
  if (result.count === 0) throw new Error("Insufficient available inventory.");
  return prisma.inventory.findUnique({ where: { skuId } });
}

export async function confirmStock(skuId: string, qty: number) {
  assertPositiveQuantity(qty);
  const result = await prisma.inventory.updateMany({
    where: {
      skuId,
      reserved: { gte: qty }
    },
    data: {
      reserved: { decrement: qty }
    }
  });
  if (result.count === 0) throw new Error("Insufficient reserved inventory.");
  return prisma.inventory.findUnique({ where: { skuId } });
}

export async function releaseStock(skuId: string, qty: number) {
  assertPositiveQuantity(qty);
  const result = await prisma.inventory.updateMany({
    where: {
      skuId,
      reserved: { gte: qty }
    },
    data: {
      available: { increment: qty },
      reserved: { decrement: qty }
    }
  });
  if (result.count === 0) throw new Error("Insufficient reserved inventory.");
  return prisma.inventory.findUnique({ where: { skuId } });
}
