import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateImage, generateVideo } from "@/lib/ai/provider";

type AiKind = "image" | "video";

const creditField = {
  image: "imageCredits",
  video: "videoCredits"
} as const;

const taskType = {
  image: "image",
  video: "video"
} as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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
  prompt?: string;
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
    const aiResult = input.prompt
      ? input.kind === "image"
        ? await generateImage({ prompt: input.prompt, userId: input.userId })
        : await generateVideo({ prompt: input.prompt, userId: input.userId })
      : null;
    await input.onSuccess?.();
    return prisma.taskLog.update({
      where: { id: task.id },
      data: {
        status: "success",
        metadata: toJsonValue(aiResult)
      }
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
