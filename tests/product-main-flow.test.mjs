import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_SOURCE_FILTERS,
  getProductNextAction,
  isContentEligibleProduct
} from "../lib/product-main-flow.ts";

test("getProductNextAction returns exactly one primary action for each main-flow status", () => {
  assert.deepEqual(getProductNextAction("discovered", "p1"), {
    label: "加入商品池",
    href: "/products/p1",
    intent: "pool"
  });
  assert.deepEqual(getProductNextAction("in_product_center", "p1"), {
    label: "开始 AI 优化",
    href: "/products/p1",
    intent: "optimize"
  });
  assert.deepEqual(getProductNextAction("optimizing", "p1").label, "查看优化进度");
  assert.deepEqual(getProductNextAction("optimized", "p1").label, "人工确认");
  assert.deepEqual(getProductNextAction("ready_to_publish", "p1").label, "发布到 Ozon");
  assert.deepEqual(getProductNextAction("published", "p1").label, "生成推广内容");
});

test("content can only be generated from optimized or published products", () => {
  assert.equal(isContentEligibleProduct("in_product_center"), false);
  assert.equal(isContentEligibleProduct("optimizing"), false);
  assert.equal(isContentEligibleProduct("optimized"), true);
  assert.equal(isContentEligibleProduct("ready_to_publish"), true);
  assert.equal(isContentEligibleProduct("published"), true);
});

test("product source filters match the customer-facing pool sources", () => {
  assert.deepEqual(PRODUCT_SOURCE_FILTERS.map((item) => item.label), [
    "全部",
    "市场调研",
    "店铺同步",
    "手动创建"
  ]);
});
