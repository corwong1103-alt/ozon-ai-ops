import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const blockedHosts = new Set(["example.com", "picsum.photos", "placehold.co", "placeholder.com", "images.unsplash.com"]);
const allowedContentTypes = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"];

function unavailableImage(reason: string) {
  const safeReason = reason.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" rx="28" fill="#f5efe6"/>
    <rect x="32" y="32" width="576" height="416" rx="22" fill="#faf6f2" stroke="#e0ccb8" stroke-width="3"/>
    <text x="320" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#433020">图片失效</text>
    <text x="320" y="276" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#b49c84">${safeReason}</text>
  </svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      "Content-Type": "image/svg+xml"
    }
  });
}

function isBlockedHost(hostname: string) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return blockedHosts.has(host) || host === "localhost" || host.endsWith(".localhost");
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function isIpv4InCidr(ip: string, base: string, bits: number) {
  const ipNumber = ipv4ToNumber(ip);
  const baseNumber = ipv4ToNumber(base);
  if (ipNumber === null || baseNumber === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipNumber & mask) === (baseNumber & mask);
}

function isPrivateIpAddress(address: string) {
  const normalized = address.toLowerCase();
  const family = isIP(normalized);

  if (family === 4) {
    return (
      normalized === "0.0.0.0" ||
      isIpv4InCidr(normalized, "10.0.0.0", 8) ||
      isIpv4InCidr(normalized, "100.64.0.0", 10) ||
      isIpv4InCidr(normalized, "127.0.0.0", 8) ||
      isIpv4InCidr(normalized, "169.254.0.0", 16) ||
      isIpv4InCidr(normalized, "172.16.0.0", 12) ||
      isIpv4InCidr(normalized, "192.168.0.0", 16)
    );
  }

  if (family === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:169.254.") ||
      normalized.startsWith("::ffff:172.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return false;
}

async function resolveImageTarget(hostname: string) {
  if (isPrivateIpAddress(hostname)) return false;

  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.length > 0 && records.every((record) => !isPrivateIpAddress(record.address));
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") || "";
  let imageUrl: URL;

  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid image url", { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol) || isBlockedHost(imageUrl.hostname)) {
    return new NextResponse("Image host is not allowed", { status: 400 });
  }

  try {
    const isAllowedTarget = await resolveImageTarget(imageUrl.hostname);
    if (!isAllowedTarget) {
      return new NextResponse("Image host is not allowed", { status: 403 });
    }

    const response = await fetch(imageUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
        Referer: `${imageUrl.protocol}//${imageUrl.hostname}/`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
      },
      next: { revalidate: 60 * 60 * 6 }
    });

    if (!response.ok) {
      return unavailableImage(`真实链接返回 ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].toLowerCase() || "";
    if (!allowedContentTypes.includes(contentType)) {
      return unavailableImage("不是可预览图片");
    }

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
        "Content-Type": contentType
      }
    });
  } catch {
    return unavailableImage("真实链接读取失败");
  }
}
