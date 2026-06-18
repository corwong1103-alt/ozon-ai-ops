import { NextRequest, NextResponse } from "next/server";

const sessionCookie = "ozon_ops_session";

const protectedPrefixes = [
  "/admin",
  "/ai-studio",
  "/collector",
  "/content",
  "/credits",
  "/customer",
  "/dashboard",
  "/integrations",
  "/membership",
  "/products",
  "/research",
  "/social",
  "/stores",
  "/tasks",
  "/pending",
  "/expired",
  "/suspended"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const hasSession = Boolean(request.cookies.get(sessionCookie)?.value);

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
