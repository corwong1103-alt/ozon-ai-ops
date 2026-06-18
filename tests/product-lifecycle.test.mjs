import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_LIFECYCLE,
  getDashboardTodoCounts,
  getProductStage,
  productStatusLabel
} from "../lib/product-lifecycle.ts";

test("PRODUCT_LIFECYCLE matches the V3 product flow from architecture docs", () => {
  assert.deepEqual(
    PRODUCT_LIFECYCLE.map((stage) => stage.key),
    [
      "discovered",
      "favorited",
      "in_product_center",
      "optimizing",
      "optimized",
      "ready_to_publish",
      "published",
      "promoted",
      "archived"
    ]
  );

  assert.equal(productStatusLabel("in_product_center"), "商品中心");
  assert.equal(productStatusLabel("archived"), "已归档");
});

test("getProductStage gives action-oriented copy for product center and archived states", () => {
  assert.equal(getProductStage("in_product_center", 2), "已入商品中心，待处理");
  assert.equal(getProductStage("archived", 1), "已归档，不参与当前铺品");
  assert.equal(getProductStage("discovered", 0), "先补真实图片");
});

test("getDashboardTodoCounts groups V3 statuses into the seller homepage workflow", () => {
  const counts = getDashboardTodoCounts({
    discovered: 2,
    favorited: 3,
    in_product_center: 4,
    optimizing: 5,
    optimized: 6,
    ready_to_publish: 7,
    published: 8,
    promoted: 9,
    archived: 10
  });

  assert.deepEqual(counts, {
    pending: 9,
    optimizing: 5,
    readyToPublish: 13,
    toPromote: 8
  });
});
