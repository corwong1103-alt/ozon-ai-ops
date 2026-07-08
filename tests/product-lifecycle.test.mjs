import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_LIFECYCLE,
  getDashboardTodoCounts,
  getProductStage,
  productStatusLabel
} from "../lib/product-lifecycle.ts";

test("PRODUCT_LIFECYCLE keeps backend statuses but renders V6 seller labels", () => {
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

  assert.equal(productStatusLabel("in_product_center"), "制作中");
  assert.equal(productStatusLabel("optimized"), "待确认");
  assert.equal(productStatusLabel("archived"), "已归档");
});

test("getProductStage gives action-oriented V6 seller copy", () => {
  assert.equal(getProductStage("in_product_center", 2), "等待继续制作");
  assert.equal(getProductStage("archived", 1), "已归档，不参与当前发布流程");
  assert.equal(getProductStage("discovered", 0), "缺少真实图片，先补来源");
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
