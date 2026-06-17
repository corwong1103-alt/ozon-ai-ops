import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteProductImage,
  moveProductImage,
  parseProductImageUrls,
  replaceProductImage
} from "../lib/product-images.ts";

test("parseProductImageUrls keeps real URLs and removes placeholder hosts", () => {
  assert.deepEqual(
    parseProductImageUrls([
      " https://img.alicdn.com/bao/uploaded/i1/real.jpg ",
      "https://images.unsplash.com/fake.jpg",
      "not-a-url",
      "https://ir-2.ozonstatic.cn/s3/multimedia.jpg"
    ]),
    [
      "https://img.alicdn.com/bao/uploaded/i1/real.jpg",
      "https://ir-2.ozonstatic.cn/s3/multimedia.jpg"
    ]
  );
});

test("image actions delete, replace, and reorder without mutating the original list", () => {
  const images = ["https://img.alicdn.com/a.jpg", "https://ir-2.ozonstatic.cn/b.jpg", "https://cdn.example.org/c.jpg"];

  assert.deepEqual(deleteProductImage(images, 1), ["https://img.alicdn.com/a.jpg", "https://cdn.example.org/c.jpg"]);
  assert.deepEqual(replaceProductImage(images, 0, "https://img.alicdn.com/new.jpg"), [
    "https://img.alicdn.com/new.jpg",
    "https://ir-2.ozonstatic.cn/b.jpg",
    "https://cdn.example.org/c.jpg"
  ]);
  assert.deepEqual(moveProductImage(images, 2, "up"), [
    "https://img.alicdn.com/a.jpg",
    "https://cdn.example.org/c.jpg",
    "https://ir-2.ozonstatic.cn/b.jpg"
  ]);
  assert.deepEqual(moveProductImage(images, 0, "up"), images);
  assert.deepEqual(images, ["https://img.alicdn.com/a.jpg", "https://ir-2.ozonstatic.cn/b.jpg", "https://cdn.example.org/c.jpg"]);
});
