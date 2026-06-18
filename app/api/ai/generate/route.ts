import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { generateText, generateImage } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireApprovedUser();
  const body = await request.json();
  const mode = String(body.mode || "text");

  try {
    if (mode === "image") {
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return NextResponse.json({ error: "请输入生图提示词。" }, { status: 400 });
      const referenceImage = String(body.referenceImage || "").trim() || undefined;
      const result = await generateImage({ prompt, userId: user.id, referenceImage });
      return NextResponse.json({ imageUrl: result.url, provider: result.provider });
    }

    // text mode
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "请输入提示词。" }, { status: 400 });

    const systemMsg = String(body.system || "你是跨境电商 AI 助手。直接输出结果，不要解释。");
    const result = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: prompt }
      ]
    });

    return NextResponse.json({ text: result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "AI 调用失败"
    }, { status: 500 });
  }
}
