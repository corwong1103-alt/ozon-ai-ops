"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = ["pending", "approved", "expired", "suspended"] as const;
const allowedPlans = ["starter", "pro", "vip"] as const;

export async function updateUserStatus(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = String(formData.get("userId") || "");
  const status = String(formData.get("status") || "");

  if (!userId || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) return;

  const target = await prisma.user.update({
    where: { id: userId },
    data: { status: status as (typeof allowedStatuses)[number] }
  });

  await prisma.adminActionLog.create({
    data: {
      adminId: admin.id,
      targetUserId: target.id,
      actionType: `set_status:${status}`,
      message: `管理员 ${admin.email} 将 ${target.email} 状态更新为 ${status}`
    }
  });

  revalidatePath("/admin");
}

export async function updateUserPlan(formData: FormData) {
  const admin = await requireAdminUser();
  const userId = String(formData.get("userId") || "");
  const plan = String(formData.get("plan") || "");
  const expiresAtValue = String(formData.get("expiresAt") || "");

  if (!userId || !allowedPlans.includes(plan as (typeof allowedPlans)[number])) return;

  const target = await prisma.user.update({
    where: { id: userId },
    data: {
      plan: plan as (typeof allowedPlans)[number],
      expiresAt: expiresAtValue ? new Date(expiresAtValue) : null
    }
  });

  await prisma.adminActionLog.create({
    data: {
      adminId: admin.id,
      targetUserId: target.id,
      actionType: "set_plan",
      message: `管理员 ${admin.email} 将 ${target.email} 等级更新为 ${plan}`
    }
  });

  revalidatePath("/admin");
}
