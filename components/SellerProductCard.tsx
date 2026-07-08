import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { imageList } from "@/lib/product-images";
import { productStatusLabel } from "@/lib/product-lifecycle";
import { getProductNextAction, productSourceFilterLabel } from "@/lib/product-main-flow";

type SellerProduct = {
  id: string;
  title: string;
  source: string;
  status: string;
  images: unknown;
  price: unknown;
  currency: string;
  updatedAt: Date;
};

function formatTime(d: Date) {
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SellerProductCard({
  product,
  hrefPrefix = "/products",
  actionLabel
}: {
  product: SellerProduct;
  hrefPrefix?: "/products" | "/factory";
  actionLabel?: string;
}) {
  const images = imageList(product.images);
  const action = getProductNextAction(product.status, product.id);
  const href = `${hrefPrefix}/${product.id}`;

  return (
    <article className="seller-product-card">
      <Link href={href} className="seller-product-image" aria-label={`打开 ${product.title}`}>
        <ReliableProductImage images={images} alt={product.title} className="h-full w-full object-cover" emptyLabel="无图" />
      </Link>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="status-chip">{productStatusLabel(product.status)}</span>
          <span className="text-xs font-medium text-steel">{productSourceFilterLabel(product.source)}</span>
        </div>
        <Link href={href} className="mt-2 block truncate text-sm font-semibold text-earth">
          {product.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-steel">
          <span>{Number(product.price).toFixed(2)} {product.currency}</span>
          <span>更新 {formatTime(product.updatedAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link href={href} className="btn-primary px-3 py-1.5 text-xs">
          {actionLabel ?? action.label}
        </Link>
        <button className="seller-more-button" type="button" aria-label="更多操作">
          <MoreHorizontal size={15} />
        </button>
      </div>
    </article>
  );
}
