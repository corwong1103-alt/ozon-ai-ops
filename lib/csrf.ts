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

export function validateCsrfRequest(request: NextRequest) {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) return true;

  const expectedOrigin = request.nextUrl.origin;
  const origin = parseOrigin(request.headers.get("origin"));
  if (origin) return origin === expectedOrigin;

  const referer = parseOrigin(request.headers.get("referer"));
  return referer === expectedOrigin;
}
