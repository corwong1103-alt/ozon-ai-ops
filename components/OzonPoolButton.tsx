"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOzonMarketProductToPool, addOzonProductToPool } from "@/app/research/actions";
import { useToast } from "@/components/Toast";
import type { OzonMarketProduct } from "@/lib/services/ozon-market";

export function OzonPoolButton({
  productId,
  storeId
}: {
  productId: string;
  storeId: string;
  productName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await addOzonProductToPool(productId, storeId);
            if (result?.ok) {
              toast("success", result.message || "已加入商品池");
              router.push("/products?joined=" + (result.addedCount || 1) + "&source=ozon");
              return;
            }
            toast("error", result?.message || "商品入池失败，请刷新后再试。");
          } catch (error) {
            toast("error", error instanceof Error ? error.message : "商品入池失败，请稍后再试。");
          }
        });
      }}
      type="button"
    >
      {pending ? "入池中…" : "加入商品池"}
    </button>
  );
}

export function OzonMarketPoolButton({
  product,
  researchKeyword
}: {
  product: OzonMarketProduct;
  researchKeyword?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await addOzonMarketProductToPool(product, researchKeyword || "");
            if (result?.ok) {
              toast("success", result.message || "已加入商品池");
              router.push("/products?joined=" + (result.addedCount || 1) + "&source=ozon_market");
              return;
            }
            toast("error", result?.message || "市场商品入池失败，请检查真实图片链接。");
          } catch (error) {
            toast("error", error instanceof Error ? error.message : "市场商品入池失败，请稍后再试。");
          }
        });
      }}
      type="button"
    >
      {pending ? "入池中…" : "加入商品池"}
    </button>
  );
}
