import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OzonProbeResource, probeOzonStore } from "@/lib/services/ozon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resources = new Set<OzonProbeResource>(["roles", "warehouses", "products", "orders"]);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const body = await request.json();
  const resource = String(body.resource || "") as OzonProbeResource;

  if (!resources.has(resource)) {
    return NextResponse.json({ error: "未知的 Ozon 测试类型。" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  });

  if (!store) {
    return NextResponse.json({ error: "店铺不存在或无权访问。" }, { status: 404 });
  }

  const result = await probeOzonStore({ resource, store });
  return NextResponse.json({ result }, { status: result.ok ? 200 : 400 });
}
