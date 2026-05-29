import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await requireApprovedUser();
  const tasks = await prisma.taskLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ tasks });
}
