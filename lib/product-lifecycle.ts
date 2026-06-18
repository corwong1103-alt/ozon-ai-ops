export type ProductStatus =
  | "discovered"
  | "favorited"
  | "in_product_center"
  | "optimizing"
  | "optimized"
  | "ready_to_publish"
  | "published"
  | "promoted"
  | "archived";

export const PRODUCT_LIFECYCLE: Array<{ key: ProductStatus; label: string }> = [
  { key: "discovered", label: "发现" },
  { key: "favorited", label: "收藏" },
  { key: "in_product_center", label: "商品中心" },
  { key: "optimizing", label: "优化中" },
  { key: "optimized", label: "已优化" },
  { key: "ready_to_publish", label: "待发布" },
  { key: "published", label: "已上架" },
  { key: "promoted", label: "已推广" },
  { key: "archived", label: "已归档" }
];

const PRODUCT_STATUS_LABELS = Object.fromEntries(
  PRODUCT_LIFECYCLE.map((stage) => [stage.key, stage.label])
) as Record<ProductStatus, string>;

export type ProductStatusCounts = Partial<Record<ProductStatus, number>>;

export function productStatusLabel(status: string) {
  return PRODUCT_STATUS_LABELS[status as ProductStatus] || status;
}

export function getProductStage(status: string, imageCount: number) {
  if (status === "archived") return "已归档，不参与当前铺品";
  if (status === "promoted") return "已推广，回流成交中";
  if (status === "published") return "已上架 Ozon";
  if (status === "ready_to_publish") return "待发布上架";
  if (status === "optimized") return "已优化，待发布";
  if (status === "optimizing") return "AI 优化中";
  if (status === "in_product_center") return "已入商品中心，待处理";
  if (status === "favorited") return "已收藏，待处理";
  if (status === "discovered" && imageCount === 0) return "先补真实图片";
  if (status === "discovered") return "待入商品中心";
  return "待处理";
}

export function getDashboardTodoCounts(counts: ProductStatusCounts) {
  return {
    pending: (counts.discovered ?? 0) + (counts.favorited ?? 0) + (counts.in_product_center ?? 0),
    optimizing: counts.optimizing ?? 0,
    readyToPublish: (counts.optimized ?? 0) + (counts.ready_to_publish ?? 0),
    toPromote: counts.published ?? 0
  };
}
