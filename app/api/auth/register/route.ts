import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const starterCredits = {
  imageCredits: 200,
  videoCredits: 20
};

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || password.length < 8) {
    return NextResponse.json({ error: "请输入邮箱，并使用至少 8 位密码。" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册，请直接登录。" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      status: "pending",
      plan: "starter",
      credits: {
        create: {
          ...starterCredits,
          monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }
    }
  });

  await createSession(user.id);

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan
      },
      redirectTo: "/pending"
    },
    { status: 201 }
  );
}
