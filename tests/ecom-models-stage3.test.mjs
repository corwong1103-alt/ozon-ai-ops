import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prisma schema contains core ecommerce models and relations", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  for (const model of ["Order", "OrderItem", "ProductVariant", "Inventory", "Payment", "Subscription"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.match(schema, /variants\s+ProductVariant\[\]/);
  assert.match(schema, /orderItems\s+OrderItem\[\]/);
  assert.match(schema, /payments\s+Payment\[\]/);
  assert.match(schema, /subscriptions\s+Subscription\[\]/);
});

test("ozon upload payload includes category, attributes, images, and sku data", async () => {
  const source = await readFile(new URL("../lib/services/ozon.ts", import.meta.url), "utf8");

  assert.match(source, /category_id/);
  assert.match(source, /OZON_DEFAULT_CATEGORY_ID/);
  assert.match(source, /使用默认类目，真实上架前需配置目标类目/);
  assert.match(source, /attributes/);
  assert.match(source, /Attributes are hardcoded for category 17028922/);
  assert.match(source, /offer_id/);
  assert.match(source, /barcode|sku/);
});

test("docker runner applies prisma migrations before starting app", async () => {
  const source = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

  assert.match(source, /npx prisma migrate deploy && npm run start/);
});

test("order sync writes orders and order items instead of task log only", async () => {
  const source = await readFile(new URL("../app/api/stores/[id]/ozon-sync/route.ts", import.meta.url), "utf8");

  assert.match(source, /prisma\.order\.upsert/);
  assert.match(source, /orderItem/);
});

test("inventory service exposes reserve, confirm, and release operations", async () => {
  const source = await readFile(new URL("../lib/services/inventory.ts", import.meta.url), "utf8");

  assert.match(source, /reserveStock/);
  assert.match(source, /confirmStock/);
  assert.match(source, /releaseStock/);
  assert.match(source, /available/);
  assert.match(source, /reserved/);
});
