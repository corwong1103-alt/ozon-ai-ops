import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { createOrReuseResearchTask, resolveSearchKey } from "@/lib/services/research-task";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireApprovedUser();
  const body = await request.json().catch(() => ({}));
  const keyword = String(body.keyword || "").trim();
  const categoryId = body.categoryId ? String(body.categoryId) : undefined;

  const { hasQuery } = resolveSearchKey(keyword, categoryId);
  if (!hasQuery) {
    return NextResponse.json({ error: "请输入关键词或选择类目。" }, { status: 400 });
  }

  const { taskId, reused } = await createOrReuseResearchTask({
    userId: user.id,
    keyword,
    categoryId
  });

  return NextResponse.json({ taskId, reused });
}
