export function extractTaskImageUrl(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const output = (data as Record<string, unknown>).output;
  if (!output || typeof output !== "object") return "";

  const resultUrls = (output as Record<string, unknown>).result_urls;
  if (Array.isArray(resultUrls) && typeof resultUrls[0] === "string") {
    return resultUrls[0];
  }

  const results = (output as Record<string, unknown>).results;
  if (!Array.isArray(results)) return "";
  const first = results[0];
  if (!first || typeof first !== "object") return "";
  const url = (first as Record<string, unknown>).url;
  return typeof url === "string" ? url : "";
}
