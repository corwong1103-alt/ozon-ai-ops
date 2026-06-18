import { test } from "node:test";
import assert from "node:assert/strict";

// 内联归一化逻辑做单元测试（与 lib/apify/1688.ts 保持一致，纯函数验证）
// 复制核心归一化函数以避免 ESM server-only 阻断。

function stringFrom(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const primary = value.split("(")[0] || value;
  const normalized = primary.replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function collectImageUrls(value, target) {
  if (!value) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) target.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, target));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectImageUrls(item, target));
  }
}

function normalize1688Product(item, index) {
  if (!item || typeof item !== "object") return null;
  const record = item;
  const title = stringFrom(record.title || record.subject || record.name || record.productName);
  if (!title) return null;
  const images = [];
  for (const key of ["images", "image", "imageUrl", "image_url", "mainImage", "photos", "thumbnail"]) {
    collectImageUrls(record[key], images);
  }
  const uniqueImages = Array.from(new Set(images));
  const productUrl = stringFrom(record.detailUrl || record.productUrl || record.link || record.url);
  const priceInteger = numberFrom(record.price_integer);
  const price = priceInteger !== undefined
    ? priceInteger + Number(`0.${String(record.price_decimal || "").replace(/^\./, "").replace(/[^\d]/g, "") || "0"}`)
    : numberFrom(record.price) || numberFrom(record.salePrice) || 0;
  return {
    id: stringFrom(record.id || record.productId || record.offerId) || `1688_${index + 1}`,
    source: "1688",
    title,
    image: uniqueImages[0] || "",
    images: uniqueImages,
    price,
    supplier: stringFrom(record.supplier || record.shopName || record.shop_name || record.company),
    supplierLevel: stringFrom(record.supplierLevel || record.shopLevel),
    sales: numberFrom(record.sale) || numberFrom(record.sales) || numberFrom(record.tradeQuantity) || numberFrom(record.order_count) || 0,
    rating: numberFrom(record.rating) || numberFrom(record.score) || numberFrom(record.composite_score) || 0,
    productUrl,
    raw: record
  };
}

test("normalize1688Product maps standard 1688 Apify fields into internal structure", () => {
  const input = {
    id: "123456789",
    title: "韩版双肩包女学生大容量背包",
    image: "https://cbu01.alicdn.com/img/ibank/abc.jpg",
    images: ["https://cbu01.alicdn.com/img/ibank/abc.jpg", "https://cbu01.alicdn.com/img/ibank/def.jpg"],
    price: "35.50",
    supplier: "义乌市XX箱包厂",
    supplierLevel: "实力商家",
    sale: "1200",
    rating: "4.8",
    detailUrl: "https://detail.1688.com/offer/123456789.html"
  };
  const result = normalize1688Product(input, 0);
  assert.equal(result.id, "123456789");
  assert.equal(result.source, "1688");
  assert.equal(result.title, "韩版双肩包女学生大容量背包");
  assert.equal(result.price, 35.5);
  assert.equal(result.supplier, "义乌市XX箱包厂");
  assert.equal(result.supplierLevel, "实力商家");
  assert.equal(result.sales, 1200);
  assert.equal(result.rating, 4.8);
  assert.equal(result.productUrl, "https://detail.1688.com/offer/123456789.html");
  assert.equal(result.images.length, 2);
});

test("normalize1688Product supports real devcake Actor field names", () => {
  const input = {
    offer_id: 779353832297,
    title: "backpack多功能男士书包双肩包三件套大容量商务电脑背包英伦风",
    price: "18.5 ($2.59)",
    price_integer: "18",
    price_decimal: ".5",
    image_url: "https://cbu01.alicdn.com/img/ibank/O1CN01jKaREE.jpg",
    shop_name: "昊庆箱包厂",
    order_count: "1595",
    composite_score: "4.5",
    detailUrl: "http://detail.m.1688.com/page/index.html?offerId=779353832297"
  };
  const result = normalize1688Product(input, 0);
  assert.equal(result.title, input.title);
  assert.equal(result.image, input.image_url);
  assert.equal(result.images.length, 1);
  assert.equal(result.price, 18.5);
  assert.equal(result.supplier, "昊庆箱包厂");
  assert.equal(result.sales, 1595);
  assert.equal(result.rating, 4.5);
  assert.equal(result.productUrl, input.detailUrl);
});

test("normalize1688Product rejects items without title and never crashes on missing fields", () => {
  // 无标题直接丢弃
  assert.equal(normalize1688Product({ price: "10" }, 0), null);
  // 非 object
  assert.equal(normalize1688Product(null, 0), null);
  assert.equal(normalize1688Product("string", 0), null);

  // 字段全缺：不崩溃，填默认值
  const minimal = normalize1688Product({ title: "只有标题的商品" }, 2);
  assert.equal(minimal.title, "只有标题的商品");
  assert.equal(minimal.id, "1688_3"); // 回退到序号
  assert.equal(minimal.price, 0);
  assert.equal(minimal.image, "");
  assert.equal(minimal.images.length, 0);
  assert.equal(minimal.supplier, "");
  assert.equal(minimal.sales, 0);
  assert.equal(minimal.rating, 0);
  assert.equal(minimal.productUrl, "");
});

test("normalize1688Product dedupes image urls and accepts subject field as title", () => {
  const dup = {
    subject: "蓝牙耳机无线入耳式",
    images: ["https://a.com/1.jpg", "https://a.com/1.jpg", "https://a.com/2.jpg"],
    image: "https://a.com/1.jpg"
  };
  const result = normalize1688Product(dup, 0);
  assert.equal(result.title, "蓝牙耳机无线入耳式");
  assert.equal(result.images.length, 2); // 去重
  assert.equal(result.image, "https://a.com/1.jpg");
});

test("parseOzonListing extracts JSON from model output with or without code fences", () => {
  // 内联 parseOzonListing 纯函数（与 lib/ai/prompts.ts 保持一致）
  // 避免直接 import prompts.ts（其依赖链含 server-only，无法在 node:test 加载）
  function parseOzonListing(raw) {
    const fallback = { titleRu: "", descriptionRu: "", attributes: [], seoKeywords: [] };
    if (!raw) return fallback;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }
    if (!parsed || typeof parsed !== "object") return fallback;
    const obj = parsed;
    return {
      titleRu: typeof obj.titleRu === "string" ? obj.titleRu.trim() : "",
      descriptionRu: typeof obj.descriptionRu === "string" ? obj.descriptionRu.trim() : "",
      attributes: Array.isArray(obj.attributes)
        ? obj.attributes
            .filter((item) => item && typeof item === "object")
            .map((item) => ({ key: String(item.key || "").trim(), value: String(item.value || "").trim() }))
            .filter((item) => item.key || item.value)
        : [],
      seoKeywords: Array.isArray(obj.seoKeywords)
        ? obj.seoKeywords.filter((item) => typeof item === "string").map((item) => String(item).trim()).filter(Boolean)
        : []
    };
  }

  const clean = `{"titleRu":"Сумка через плечо","descriptionRu":"Модная","attributes":[{"key":"Материал","value":"Нейлон"}],"seoKeywords":["сумка","рюкзак"]}`;
  const fenced = "```json\n" + clean + "\n```";
  const withPreamble = `好的，这是结果：\n${clean}\n以上是 JSON。`;

  for (const raw of [clean, fenced, withPreamble]) {
    const listing = parseOzonListing(raw);
    assert.equal(listing.titleRu, "Сумка через плечо");
    assert.equal(listing.descriptionRu, "Модная");
    assert.equal(listing.attributes.length, 1);
    assert.equal(listing.attributes[0].key, "Материал");
    assert.deepEqual(listing.seoKeywords, ["сумка", "рюкзак"]);
  }

  const broken = parseOzonListing("这不是 JSON");
  assert.equal(broken.titleRu, "");
  assert.equal(broken.attributes.length, 0);
});
