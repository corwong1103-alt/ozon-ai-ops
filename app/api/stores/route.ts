import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireApprovedUser();
  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ stores });
}

export async function POST(request: Request) {
  const user = await requireApprovedUser();
  const body = await request.json();
  const name = String(body.name || "").trim();
  const ozonStoreId = String(body.ozonStoreId || "").trim();
  const ozonClientId = String(body.ozonClientId || body.ozonStoreId || "").trim();
  const apiKey = String(body.apiKey || "").trim();

  if (!name || !ozonStoreId || !ozonClientId || !apiKey) {
    return NextResponse.json({ error: "店铺名称、Ozon Store ID、Ozon Client ID 和 Ozon API Key 不能为空。" }, { status: 400 });
  }

  const store = await prisma.store.create({
    data: {
      userId: user.id,
      name,
      ozonStoreId,
      ozonClientId,
      apiKeyEncrypted: encryptSecret(apiKey)
    }
  });

  return NextResponse.json({ store }, { status: 201 });
}
