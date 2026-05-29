import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  redirect("/login");
}
