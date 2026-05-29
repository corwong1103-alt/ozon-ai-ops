import "server-only";

import { prisma } from "@/lib/prisma";

type AiKind = "image" | "video";

const creditField = {
  image: "imageCredits",
  video: "videoCredits"
} as const;

const taskType = {
  image: "image",
  video: "video"
} as const;

export async function runBaseTranslationTask(input: {
  userId: string;
  productId?: string;
  message: string;
}) {
  return prisma.taskLog.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      type: "translate",
      status: "success",
      creditCost: 0,
      message: input.message
    }
  });
}

export async function runCreditAiTask(input: {
  userId: string;
  productId?: string;
  kind: AiKind;
  message: string;
  onSuccess?: () => Promise<unknown>;
}) {
  const field = creditField[input.kind];
  const credits = await prisma.aiCredits.findUnique({ where: { userId: input.userId } });

  if (!credits || credits[field] <= 0) {
    return prisma.taskLog.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        type: taskType[input.kind],
        status: "failed",
        creditCost: 0,
        message: input.kind === "image" ? "AI商品图额度不足，请联系管理员充值" : "AI视频额度不足，请联系管理员充值"
      }
    });
  }

  const task = await prisma.$transaction(async (tx) => {
    await tx.aiCredits.update({
      where: { userId: input.userId },
      data: { [field]: { decrement: 1 } }
    });

    const created = await tx.taskLog.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        type: taskType[input.kind],
        status: "processing",
        creditCost: 1,
        message: input.message
      }
    });

    return created;
  });

  try {
    // External AI providers will be called here with process.env.AI_API_KEY.
    await input.onSuccess?.();
    return prisma.taskLog.update({
      where: { id: task.id },
      data: { status: "success" }
    });
  } catch (error) {
    await prisma.aiCredits.update({
      where: { userId: input.userId },
      data: { [field]: { increment: 1 } }
    });

    return prisma.taskLog.update({
      where: { id: task.id },
      data: {
        status: "failed",
        creditCost: 0,
        message: `${input.message}，已失败并返还额度。`
      }
    });
  }
}
