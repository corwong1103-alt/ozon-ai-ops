import { NextRequest } from "next/server";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * 在反向代理（Nginx）后面，request.nextUrl.origin 是容器内部地址
 * （如 http://localhost:3000），与浏览器发送的 Origin 不匹配。
 * 用 X-Forwarded-Host / Host header 构造真实对外 origin。
 */
function expectedRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (host) return `${forwardedProto}://${host}`;
  return request.nextUrl.origin;
}

export function validateCsrfRequest(request: NextRequest) {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) return true;

  const expectedOrigin = expectedRequestOrigin(request);
  const origin = parseOrigin(request.headers.get("origin"));
  if (origin) return origin === expectedOrigin;

  const referer = parseOrigin(request.headers.get("referer"));
  return referer === expectedOrigin;
}
