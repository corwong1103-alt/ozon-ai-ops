import assert from "node:assert/strict";
import test from "node:test";

import { normalizeApifyOzonProduct } from "../lib/ozon-market-normalizer.ts";

test("normalizeApifyOzonProduct maps Apify Ozon fields into OzonAI market products", () => {
  const product = normalizeApifyOzonProduct(
    {
      id: 123456,
      title: "Travel backpack",
      price: "1 299 ₽",
      oldPrice: "1 999 ₽",
      rating: "4.8",
      reviewsCount: "328",
      seller: { name: "Ozon Seller" },
      images: [
        "https://cdn1.ozone.ru/s3/multimedia-a/real-1.jpg",
        { url: "https://cdn1.ozone.ru/s3/multimedia-b/real-2.jpg" }
      ],
      url: "https://www.ozon.ru/product/travel-backpack-123456/",
      category: "Bags"
    },
    0
  );

  assert.deepEqual(product, {
    source: "ozon_market",
    externalId: "123456",
    title: "Travel backpack",
    price: 1299,
    oldPrice: 1999,
    rating: 4.8,
    reviewCount: 328,
    seller: "Ozon Seller",
    imageUrl: "https://cdn1.ozone.ru/s3/multimedia-a/real-1.jpg",
    images: [
      "https://cdn1.ozone.ru/s3/multimedia-a/real-1.jpg",
      "https://cdn1.ozone.ru/s3/multimedia-b/real-2.jpg"
    ],
    productUrl: "https://www.ozon.ru/product/travel-backpack-123456/",
    category: "Bags"
  });
});

test("normalizeApifyOzonProduct rejects items without title and keeps no-image products real", () => {
  assert.equal(normalizeApifyOzonProduct({ price: 100 }, 0), null);

  assert.deepEqual(normalizeApifyOzonProduct({ name: "Pet toy", productId: "pet-1" }, 1), {
    source: "ozon_market",
    externalId: "pet-1",
    title: "Pet toy"
  });
});

test("normalizeApifyOzonProduct supports real Ozon Scraper PRO fields", () => {
  const product = normalizeApifyOzonProduct(
    {
      sku: "3539514245",
      productId: 3539514245,
      title: "Рюкзак мужской городской",
      productLink: "https://www.ozon.ru/product/ryukzak-muzhskoy-gorodskoy-3539514245/",
      cardPriceDecimal: 1658,
      originalPriceDecimal: 6490,
      coverImageUrl: "https://ir.ozone.ru/s3/multimedia-1-r/9607564035.jpg",
      rating: 4.9,
      reviewCount: 3260,
      seller: { name: "Рюкзак Backpack" },
      breadcrumbs: [{ name: "Аксессуары" }, { name: "Рюкзаки" }]
    },
    0
  );

  assert.equal(product?.externalId, "3539514245");
  assert.equal(product?.title, "Рюкзак мужской городской");
  assert.equal(product?.price, 1658);
  assert.equal(product?.oldPrice, 6490);
  assert.equal(product?.imageUrl, "https://ir.ozone.ru/s3/multimedia-1-r/9607564035.jpg");
  assert.equal(product?.productUrl, "https://www.ozon.ru/product/ryukzak-muzhskoy-gorodskoy-3539514245/");
  assert.equal(product?.rating, 4.9);
  assert.equal(product?.reviewCount, 3260);
  assert.equal(product?.seller, "Рюкзак Backpack");
  assert.equal(product?.category, "Рюкзаки");
});

test("normalizeApifyOzonProduct supports nested card price from search result sellers", () => {
  const product = normalizeApifyOzonProduct(
    {
      sku: "4775105486",
      title: "Рюкзак",
      productLink: "https://www.ozon.ru/product/ryukzak-4775105486/",
      coverImage: "https://ir.ozone.ru/s3/multimedia-1-1/9137897029.jpg",
      price: {
        cardPrice: {
          price: "657 ₽"
        }
      },
      rating: {
        totalScore: 4.5,
        reviewsCount: 2
      }
    },
    0
  );

  assert.equal(product?.price, 657);
  assert.equal(product?.rating, 4.5);
  assert.equal(product?.reviewCount, 2);
  assert.equal(product?.imageUrl, "https://ir.ozone.ru/s3/multimedia-1-1/9137897029.jpg");
});

test("normalizeApifyOzonProduct falls back to deep price keys", () => {
  const product = normalizeApifyOzonProduct(
    {
      sku: "case-1",
      title: "Phone case",
      url: "https://www.ozon.ru/product/case-1/",
      coverImageUrl: "https://ir.ozone.ru/case.jpg",
      tile: {
        price: {
          current: {
            price: "412 ₽"
          }
        }
      }
    },
    0
  );

  assert.equal(product?.price, 412);
});
