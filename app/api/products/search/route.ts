import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await requireApprovedUser();
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") === "ozon" ? "research" : "collect";

  const task = await prisma.taskLog.create({
    data: {
      userId: user.id,
      type: source,
      status: "success",
      creditCost: 0,
      message: "搜索接口框架已接入，真实 Ozon/1688 数据源将在后续模块实现。"
    }
  });

  return NextResponse.json({ products: [], task });
}
