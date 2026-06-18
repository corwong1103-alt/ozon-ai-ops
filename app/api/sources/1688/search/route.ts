import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth";
import { search1688Products } from "@/lib/apify/1688";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/sources/1688/search
 * Body: { keyword: string }
 * 调用 Apify 1688 Actor 搜索真实 1688 商品，返回归一化结果。
 * 不写入数据库（导入走 /api/sources/1688/import）。
 */
export async function POST(request: Request) {
  const user = await requireApprovedUser();

  let keyword = "";
  try {
    const body = await request.json();
    keyword = String(body?.keyword || "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "请求体格式错误，需要 JSON。" }, { status: 400 });
  }

  if (!keyword) {
    return NextResponse.json({ success: false, error: "keyword 不能为空。" }, { status: 400 });
  }

  try {
    const products = await search1688Products({ userId: user.id, keyword });
    return NextResponse.json({ success: true, keyword, count: products.length, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "1688 搜索失败。";
    const code = (error as { code?: string })?.code;
    const status = code === "APIFY_NOT_CONFIGURED" ? 412 : 500;
    console.error("[1688_search_error]", message);
    return NextResponse.json({ success: false, error: message, code }, { status });
  }
}
