const proxyableProtocols = new Set(["http:", "https:"]);

export function proxiedImageUrl(url: string) {
  const value = url.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    if (!proxyableProtocols.has(parsed.protocol)) return "";
    return `/api/image-proxy?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return "";
  }
}
