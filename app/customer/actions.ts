"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { generateText } from "@/lib/ai/provider";
import { buildCustomerReplyPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";

export async function syncMockCustomerMessages() {
  const user = await requireApprovedUser();
  const store = await prisma.store.findFirst({ where: { userId: user.id } });
  const samples = [
    { id: "mock_presale", customerName: "Anna K.", message: "这个保温杯适合送礼吗？", category: "presale" },
    { id: "mock_logistics", customerName: "Ivan P.", message: "物流超过预计时间了。", category: "logistics" },
    { id: "mock_refund", customerName: "Maria S.", message: "我想申请退款。", category: "refund" },
    { id: "mock_review", customerName: "Ozon Review", message: "出现一条差评提醒。", category: "review_alert" },
    { id: "mock_inventory", customerName: "Ozon Stock", message: "库存低于安全线。", category: "inventory_alert" }
  ] as const;

  for (const sample of samples) {
    await prisma.customerMessage.upsert({
      where: { id: `${sample.id}_${user.id}` },
      update: {},
      create: {
        id: `${sample.id}_${user.id}`,
        userId: user.id,
        storeId: store?.id,
        customerName: sample.customerName,
        message: sample.message,
        category: sample.category,
        status: sample.category.includes("alert") ? "alert" : "pending"
      }
    });
  }

  await prisma.taskLog.create({
    data: {
      userId: user.id,
      type: "customer_message",
      status: "success",
      creditCost: 0,
      message: "已同步 mock Ozon 客服消息。"
    }
  });

  revalidatePath("/customer");
  return {
    ok: true,
    message: "客服测试消息已生成。"
  };
}

export async function generateCustomerReply(messageId: string) {
  const user = await requireApprovedUser();
  const message = await prisma.customerMessage.findFirst({ where: { id: messageId, userId: user.id } });
  if (!message) return { ok: false, message: "未找到客服消息，无法生成回复建议。" };

  await prisma.customerMessage.update({
    where: { id: message.id },
    data: {
      suggestedReply: await generateText({
        userId: user.id,
        messages: [
          { role: "system", content: "你是可靠克制的跨境电商客服助手。" },
          { role: "user", content: buildCustomerReplyPrompt({
            customerName: message.customerName,
            message: message.message,
            category: message.category
          }) }
        ]
      }),
      status: "suggested"
    }
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      storeId: message.storeId,
      type: "auto_reply",
      status: "success",
      creditCost: 0,
      message: `已生成客服回复建议：${message.customerName}`
    }
  });

  revalidatePath("/customer");
  return {
    ok: true,
    message: `已生成客服回复建议：${message.customerName}`
  };
}

export async function sendCustomerReply(messageId: string) {
  const user = await requireApprovedUser();
  const message = await prisma.customerMessage.findFirst({ where: { id: messageId, userId: user.id } });
  if (!message) return { ok: false, message: "未找到客服消息，无法发送回复。" };

  await prisma.customerMessage.update({
    where: { id: message.id },
    data: { status: "replied" }
  });
  await prisma.taskLog.create({
    data: {
      userId: user.id,
      storeId: message.storeId,
      type: "customer_message",
      status: "success",
      creditCost: 0,
      message: `已发送客服回复：${message.customerName}`
    }
  });

  revalidatePath("/customer");
  return {
    ok: true,
    message: `已模拟发送客服回复：${message.customerName}`
  };
}
