import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";

const sessionCookie = "ozon_ops_session";
const publicApiPrefixes = ["/api/auth/login", "/api/auth/logout", "/api/auth/register", "/api/image-proxy"];

const protectedPrefixes = [
  "/api",
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
  "/settings",
  "/social",
  "/stores",
  "/tasks",
  "/help",
  "/pending",
  "/expired",
  "/suspended"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicApi = publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isProtected = !isPublicApi && protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const hasSession = Boolean(request.cookies.get(sessionCookie)?.value);

  if (pathname.startsWith("/api/") && !isPublicApi && !validateCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

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
