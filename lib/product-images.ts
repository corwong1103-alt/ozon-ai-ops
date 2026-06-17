const blockedImageHosts = new Set(["example.com", "images.unsplash.com", "picsum.photos", "placehold.co", "placeholder.com"]);

export type ImageMoveDirection = "up" | "down";

function normalizeImageUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "");
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (blockedImageHosts.has(host)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function parseProductImageUrls(value: unknown) {
  const values = Array.isArray(value) ? value : String(value || "").split("\n");
  const seen = new Set<string>();

  return values
    .map(normalizeImageUrl)
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

export function imageList(value: unknown) {
  return parseProductImageUrls(Array.isArray(value) ? value : []);
}

export function deleteProductImage(images: string[], index: number) {
  return images.filter((_, currentIndex) => currentIndex !== index);
}

export function replaceProductImage(images: string[], index: number, nextUrl: unknown) {
  const [url] = parseProductImageUrls([nextUrl]);
  if (!url || index < 0 || index >= images.length) return images;

  return images.map((image, currentIndex) => currentIndex === index ? url : image);
}

export function moveProductImage(images: string[], index: number, direction: ImageMoveDirection) {
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= images.length || nextIndex < 0 || nextIndex >= images.length) {
    return images;
  }

  const nextImages = [...images];
  const image = nextImages[index];
  nextImages[index] = nextImages[nextIndex];
  nextImages[nextIndex] = image;
  return nextImages;
}

export function moveProductImageTo(images: string[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= images.length ||
    toIndex >= images.length ||
    fromIndex === toIndex
  ) {
    return images;
  }

  const nextImages = [...images];
  const [image] = nextImages.splice(fromIndex, 1);
  nextImages.splice(toIndex, 0, image);
  return nextImages;
}
