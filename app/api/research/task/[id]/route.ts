import { NextRequest, NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { getResearchTaskForUser, retryResearchTask } from "@/lib/services/research-task";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const task = await getResearchTaskForUser(params.id, user.id);
  if (!task) {
    return NextResponse.json({ error: "任务不存在或无权访问。" }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireApprovedUser();
  const result = await retryResearchTask(params.id, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, taskId: result.taskId, message: result.message });
}
