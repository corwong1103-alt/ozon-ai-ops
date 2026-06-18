import "server-only";

import type { OzonMarketUiProduct } from "@/lib/ozon-market-normalizer";

export type ScoredProduct = OzonMarketUiProduct & {
  scores: {
    heat: number;        // 热度 0-100（评分+评论数）
    profit: number;      // 利润 0-100（价格+有图）
    competition: number; // 竞争 0-100（评论数越多竞争越激烈）
    recommend: number;   // 推荐 0-100（综合）
  };
};

const PRICE_PROFIT_CEIL = 5000;   // 价格利润上限（RUB）
const REVIEW_HEAT_CEIL = 500;     // 热度评论上限
const REVIEW_COMP_CEIL = 1000;    // 竞争评论上限

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * 多维评分：热度 / 利润 / 竞争 / 推荐。
 * 基于 Ozon 返回的 rating / reviewCount / price / images 计算。
 */
export function scoreProduct(product: OzonMarketUiProduct): ScoredProduct {
  const rating = typeof product.rating === "number" ? product.rating : 0;
  const reviewCount = typeof product.reviewCount === "number" ? product.reviewCount : 0;
  const price = typeof product.price === "number" ? product.price : 0;
  const hasImage = (product.images?.length ?? 0) > 0;

  // 热度：评分占 60%，评论数占 40%
  const ratingScore = (rating / 5) * 60;
  const reviewHeatScore = Math.min(reviewCount / REVIEW_HEAT_CEIL, 1) * 40;
  const heat = clamp(ratingScore + reviewHeatScore);

  // 利润：价格分位 70% + 有图 30%（有图可营销，利润空间大）
  const priceScore = Math.min(price / PRICE_PROFIT_CEIL, 1) * 70;
  const imageScore = hasImage ? 30 : 0;
  const profit = clamp(priceScore + imageScore);

  // 竞争：评论数越多竞争越激烈（0-100，高=竞争大）
  const competition = clamp(Math.min(reviewCount / REVIEW_COMP_CEIL, 1) * 100);

  // 推荐：热度 40% + 利润 30% + 低竞争 30%
  const recommend = clamp(heat * 0.4 + profit * 0.3 + (100 - competition) * 0.3);

  return {
    ...product,
    scores: {
      heat: Math.round(heat),
      profit: Math.round(profit),
      competition: Math.round(competition),
      recommend: Math.round(recommend)
    }
  };
}

export function scoreProducts(products: OzonMarketUiProduct[]): ScoredProduct[] {
  return products.map(scoreProduct).sort((a, b) => b.scores.recommend - a.scores.recommend);
}
