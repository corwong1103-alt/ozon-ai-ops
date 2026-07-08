import type { ProductStatus } from "@/lib/product-lifecycle";

export type ProductNextActionIntent =
  | "pool"
  | "optimize"
  | "progress"
  | "confirm"
  | "publish"
  | "promote"
  | "archived";

export type ProductNextAction = {
  label: string;
  href: string;
  intent: ProductNextActionIntent;
};

export const PRODUCT_SOURCE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "market", label: "市场调研" },
  { key: "store", label: "店铺同步" },
  { key: "manual", label: "手动创建" }
] as const;

export type ProductSourceFilterKey = (typeof PRODUCT_SOURCE_FILTERS)[number]["key"];

export function getProductNextAction(status: string, productId: string): ProductNextAction {
  const href = `/products/${productId}`;
  switch (status as ProductStatus) {
    case "discovered":
      return { label: "加入商品制作", href, intent: "pool" };
    case "favorited":
      return { label: "加入商品制作", href, intent: "pool" };
    case "in_product_center":
      return { label: "继续制作", href, intent: "optimize" };
    case "optimizing":
      return { label: "继续制作", href, intent: "progress" };
    case "optimized":
      return { label: "确认商品", href, intent: "confirm" };
    case "ready_to_publish":
      return { label: "立即发布", href, intent: "publish" };
    case "published":
    case "promoted":
      return { label: "查看商品", href, intent: "promote" };
    case "archived":
      return { label: "已归档", href, intent: "archived" };
    default:
      return { label: "继续处理", href, intent: "progress" };
  }
}

export function isContentEligibleProduct(status: string) {
  return status === "optimized" || status === "ready_to_publish" || status === "published" || status === "promoted";
}

export function productSourceFilterLabel(source: string) {
  if (source === "ozon_market") return "Ozon";
  if (source === "ozon") return "店铺同步";
  if (source === "manual") return "手动创建";
  if (source === "source_1688") return "1688";
  return source;
}
