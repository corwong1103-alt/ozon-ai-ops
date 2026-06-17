import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { checkOzonCredentials } from "@/lib/services/ozon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const ozonClientId = String(body.ozonClientId || "").trim();
  const ozonStoreId = String(body.ozonStoreId || ozonClientId).trim();
  const apiKey = String(body.apiKey || "").trim();

  if (!name || !ozonClientId || !apiKey) {
    return NextResponse.json({ error: "店铺名称、Ozon Client ID 和 Ozon API Key 不能为空。" }, { status: 400 });
  }

  const credentialCheck = await checkOzonCredentials({ ozonClientId, apiKey });
  if (!credentialCheck.ok) {
    return NextResponse.json(
      {
        error: `Ozon API 凭证校验失败。请确认 Client ID、API Key 和权限后再试。${credentialCheck.status ? ` 状态码：${credentialCheck.status}` : ""}`
      },
      { status: 400 }
    );
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
