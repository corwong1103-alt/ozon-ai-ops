import assert from "node:assert/strict";
import test from "node:test";

import { sellerNavItems } from "../lib/navigation.ts";
import {
  SELLER_WORKFLOW_STEPS,
  getSellerWorkflowStep,
  productStatusLabel
} from "../lib/product-lifecycle.ts";
import { getProductNextAction } from "../lib/product-main-flow.ts";

test("seller navigation uses the V6 customer-facing workflow labels", () => {
  assert.deepEqual(
    sellerNavItems.map((item) => item.label),
    ["首页", "发现商品", "商品制作", "待发布", "已发布", "店铺管理", "账户中心", "设置", "帮助中心"]
  );
});

test("product statuses render as seller-facing lifecycle labels", () => {
  assert.equal(productStatusLabel("discovered"), "待筛选");
  assert.equal(productStatusLabel("favorited"), "待筛选");
  assert.equal(productStatusLabel("in_product_center"), "制作中");
  assert.equal(productStatusLabel("optimizing"), "制作中");
  assert.equal(productStatusLabel("optimized"), "待确认");
  assert.equal(productStatusLabel("ready_to_publish"), "待发布");
  assert.equal(productStatusLabel("published"), "已发布");
  assert.equal(productStatusLabel("promoted"), "已发布");
});

test("seller workflow exposes four plain-language steps", () => {
  assert.deepEqual(
    SELLER_WORKFLOW_STEPS.map((step) => step.label),
    ["发现商品", "制作商品", "确认商品", "发布商品"]
  );

  const firstStep = getSellerWorkflowStep("discovered");
  assert.equal(firstStep.index, 0);
  assert.equal(firstStep.label, "发现商品");
  assert.equal(firstStep.next, "加入商品制作");
  assert.equal(getSellerWorkflowStep("optimizing").label, "制作商品");
  assert.equal(getSellerWorkflowStep("optimized").label, "确认商品");
  assert.equal(getSellerWorkflowStep("ready_to_publish").label, "发布商品");
});

test("primary product actions match the V6 seller workflow", () => {
  assert.equal(getProductNextAction("discovered", "p1").label, "加入商品制作");
  assert.equal(getProductNextAction("in_product_center", "p1").label, "继续制作");
  assert.equal(getProductNextAction("optimizing", "p1").label, "继续制作");
  assert.equal(getProductNextAction("optimized", "p1").label, "确认商品");
  assert.equal(getProductNextAction("ready_to_publish", "p1").label, "立即发布");
  assert.equal(getProductNextAction("published", "p1").label, "查看商品");
});
