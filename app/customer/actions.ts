"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const replies: Record<string, string> = {
  presale: "您好，这款商品适合日常使用和礼品场景，详情页中会标注关键参数。",
  logistics: "您好，我们已收到您的物流咨询，会优先核对包裹轨迹并及时反馈。",
  refund: "您好，我们会根据 Ozon 平台售后规则协助处理退款申请。",
  review_alert: "您好，非常抱歉给您带来不便，我们会尽快核实问题并提供解决方案。",
  inventory_alert: "系统提醒：建议检查库存并及时补货，避免影响店铺评分。"
};

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
}

export async function generateCustomerReply(messageId: string) {
  const user = await requireApprovedUser();
  const message = await prisma.customerMessage.findFirst({ where: { id: messageId, userId: user.id } });
  if (!message) return;

  await prisma.customerMessage.update({
    where: { id: message.id },
    data: {
      suggestedReply: replies[message.category] ?? "您好，我们已收到您的消息，会尽快处理。",
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
}

export async function sendCustomerReply(messageId: string) {
  const user = await requireApprovedUser();
  const message = await prisma.customerMessage.findFirst({ where: { id: messageId, userId: user.id } });
  if (!message) return;

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
}
