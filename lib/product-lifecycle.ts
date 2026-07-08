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
  { key: "discovered", label: "待筛选" },
  { key: "favorited", label: "待筛选" },
  { key: "in_product_center", label: "制作中" },
  { key: "optimizing", label: "制作中" },
  { key: "optimized", label: "待确认" },
  { key: "ready_to_publish", label: "待发布" },
  { key: "published", label: "已发布" },
  { key: "promoted", label: "已发布" },
  { key: "archived", label: "已归档" }
];

const PRODUCT_STATUS_LABELS = Object.fromEntries(
  PRODUCT_LIFECYCLE.map((stage) => [stage.key, stage.label])
) as Record<ProductStatus, string>;

export type ProductStatusCounts = Partial<Record<ProductStatus, number>>;

export const SELLER_WORKFLOW_STEPS = [
  { label: "发现商品", description: "找到值得测试的真实商品" },
  { label: "制作商品", description: "用 AI 整理标题、描述、图片、属性和价格" },
  { label: "确认商品", description: "人工检查上架资料是否可信" },
  { label: "发布商品", description: "选择店铺并发布到 Ozon" }
] as const;

const STATUS_WORKFLOW_INDEX: Partial<Record<ProductStatus, number>> = {
  discovered: 0,
  favorited: 0,
  in_product_center: 1,
  optimizing: 1,
  optimized: 2,
  ready_to_publish: 3,
  published: 3,
  promoted: 3
};

const STATUS_NEXT_COPY: Partial<Record<ProductStatus, string>> = {
  discovered: "加入商品制作",
  favorited: "加入商品制作",
  in_product_center: "继续制作",
  optimizing: "继续制作",
  optimized: "确认商品",
  ready_to_publish: "立即发布",
  published: "查看商品",
  promoted: "查看商品",
  archived: "已归档"
};

export function productStatusLabel(status: string) {
  return PRODUCT_STATUS_LABELS[status as ProductStatus] || status;
}

export function getSellerWorkflowStep(status: string) {
  const normalized = status as ProductStatus;
  const index = STATUS_WORKFLOW_INDEX[normalized] ?? 0;
  const step = SELLER_WORKFLOW_STEPS[index];
  return {
    index,
    label: step.label,
    description: step.description,
    next: STATUS_NEXT_COPY[normalized] ?? "继续处理"
  };
}

export function getProductStage(status: string, imageCount: number) {
  if (status === "archived") return "已归档，不参与当前发布流程";
  if (status === "promoted") return "已发布，可继续复盘";
  if (status === "published") return "已发布到 Ozon";
  if (status === "ready_to_publish") return "资料已确认，下一步发布";
  if (status === "optimized") return "等待人工确认";
  if (status === "optimizing") return "AI Workspace 正在制作";
  if (status === "in_product_center") return "等待继续制作";
  if (status === "favorited") return "已筛选，等待制作";
  if (status === "discovered" && imageCount === 0) return "缺少真实图片，先补来源";
  if (status === "discovered") return "等待加入制作";
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
