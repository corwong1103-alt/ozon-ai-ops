import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      message: source === "research"
        ? "Ozon 真实调研请使用 /research/ozon 或店铺页同步，图片来自 Seller API。"
        : "1688 真实采集待接入商品链接抓取或开放平台 API；不会返回 mock 商品图。"
    }
  });

  return NextResponse.json({ products: [], task });
}
