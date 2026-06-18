// P0-1 MarketSearchCache 压力测试
// 本地无真实 Apify token，用 dummy token 让 config.configured=true。
// 命中路径：手动插缓存 → 搜对应英文词 → 验证命中（ozonKeyword 映射）
// 未命中路径：搜无缓存词 → 调 Apify → dummy token 401 → error 路径
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

// 模拟真实 Apify 返回的归一化商品（结构同 OzonMarketProduct）
const mockRyzakProducts = [
  {
    externalId: "10675173995",
    title: "Рюкзак HV379 черный, 28х12х40 см",
    price: 494,
    currency: "RUB",
    imageUrl: "https://ir.ozone.ru/s3/multimedia-1-z/10675173995.jpg",
    images: ["https://ir.ozone.ru/s3/multimedia-1-z/10675173995.jpg"],
    rating: 4.8,
    reviewCount: 123,
    seller: "HV379 Store",
    productUrl: "https://www.ozon.ru/product/10675173995/",
    category: "fashion",
    salesRank: undefined
  },
  {
    externalId: "10675173996",
    title: "Рюкзак городской большой",
    price: 1200,
    currency: "RUB",
    imageUrl: "https://ir.ozone.ru/s3/multimedia-1-z/10675173996.jpg",
    images: ["https://ir.ozone.ru/s3/multimedia-1-z/10675173996.jpg"],
    rating: 4.6,
    reviewCount: 87,
    seller: "Urban Bags",
    productUrl: "https://www.ozon.ru/product/10675173996/",
    category: "fashion",
    salesRank: undefined
  }
];

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "demo123456" })
  });
  const setCookie = r.headers.get("set-cookie");
  const cookie = setCookie?.split(";")[0] || "";
  console.log(`[login] HTTP ${r.status} cookie=${cookie.slice(0, 30)}...`);
  return cookie;
}

async function search(cookie, keyword, category = "") {
  const params = new URLSearchParams({ mode: "market", keyword });
  if (category) params.set("category", category);
  const t0 = Date.now();
  const r = await fetch(`${BASE}/research/ozon?${params}`, {
    headers: { Cookie: cookie }
  });
  const html = await r.text();
  const ms = Date.now() - t0;
  // 从 HTML 提取关键信息
  const fromCache = /从缓存读取/.test(html);
  const apifyOk = /已通过 Apify 读取/.test(html);
  const apifyErr = /Apify Ozon Market 请求失败/.test(html);
  const unconfigured = /尚未接入/.test(html);
  const productCount = (html.match(/research-product-card/g) || []).length;
  const firstTitle = (html.match(/<h3>([^<]+)<\/h3>/) || [])[1] || "";
  const hitInfo = (html.match(/累计命中 (\d+) 次.*?缓存年龄 (\d+)s/) || []);
  return { status: r.status, ms, fromCache, apifyOk, apifyErr, unconfigured, productCount, firstTitle, hitInfo };
}

async function getCache(keyword) {
  return prisma.marketSearchCache.findUnique({
    where: { keyword_category: { keyword, category: "" } }
  });
}

async function main() {
  const results = {};
  const cookie = await login();

  // ═══ 清场 ═══
  await prisma.marketSearchCache.deleteMany({});
  console.log("\n=== 清空缓存 ===\n");

  // ═══ 测试 1: 同关键词重复搜索（缓存命中收益）═══
  console.log("═══ 测试1: 同关键词重复搜索 ═══");
  // 插入 "рюкзак" 缓存（backpack 经 ozonKeyword 映射为 рюкзак）
  await prisma.marketSearchCache.create({
    data: {
      keyword: "рюкзак",
      category: "",
      result: mockRyzakProducts,
      productCount: 2,
      source: "apify",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    }
  });
  console.log("已插入 рюкзак 缓存（对应英文 backpack）");

  const t1a = await search(cookie, "backpack");
  const t1b = await search(cookie, "backpack");
  const t1c = await search(cookie, "backpack");
  const cacheAfter = await getCache("рюкзак");
  results.repeat = {
    first:  t1a,
    second: t1b,
    third:  t1c,
    hitCountAfter: cacheAfter?.hitCount
  };
  console.log(`  第1次: ${t1a.ms}ms fromCache=${t1a.fromCache} products=${t1a.productCount} title="${t1a.firstTitle}"`);
  console.log(`  第2次: ${t1b.ms}ms fromCache=${t1b.fromCache} hitInfo=${JSON.stringify(t1b.hitInfo)}`);
  console.log(`  第3次: ${t1c.ms}ms fromCache=${t1c.fromCache} hitInfo=${JSON.stringify(t1c.hitInfo)}`);
  console.log(`  DB hitCount=${cacheAfter?.hitCount}`);

  // ═══ 测试 2: 不同关键词搜索（未命中→Apify）═══
  console.log("\n═══ 测试2: 不同关键词搜索（未命中）═══");
  const t2a = await search(cookie, "serum");
  const t2b = await search(cookie, "led lamp");
  const t2c = await search(cookie, "dog toy");
  results.diffKeywords = { serum: t2a, ledLamp: t2b, dogToy: t2c };
  console.log(`  serum:    ${t2a.ms}ms apifyErr=${t2a.apifyErr} products=${t2a.productCount}`);
  console.log(`  led lamp: ${t2b.ms}ms apifyErr=${t2b.apifyErr} products=${t2b.productCount}`);
  console.log(`  dog toy:  ${t2c.ms}ms apifyErr=${t2c.apifyErr} products=${t2c.productCount}`);
  // serum 无 ozonKeyword 映射，原样查；检查是否有缓存写入尝试（Apify 失败不写缓存）
  const serumCache = await getCache("serum");
  console.log(`  serum 缓存是否写入: ${serumCache ? "是(异常)" : "否(正确,Apify失败不写)"}`);

  // ═══ 测试 3: 缓存过期测试 ═══
  console.log("\n═══ 测试3: 缓存过期 ═══");
  // 把 рюкзак 缓存 expiresAt 设为过去
  await prisma.marketSearchCache.update({
    where: { keyword_category: { keyword: "рюкзак", category: "" } },
    data: { expiresAt: new Date(Date.now() - 1000) } // 1秒前过期
  });
  console.log("已把 рюкзак 缓存 expiresAt 设为过去");
  const t3 = await search(cookie, "backpack");
  const cacheAfterExpiry = await getCache("рюкзак");
  results.expiry = {
    search: t3,
    cacheHitCountAfterExpiry: cacheAfterExpiry?.hitCount,
    cacheExpiresAt: cacheAfterExpiry?.expiresAt
  };
  console.log(`  过期后搜 backpack: ${t3.ms}ms fromCache=${t3.fromCache} apifyErr=${t3.apifyErr}`);
  console.log(`  过期缓存 hitCount=${cacheAfterExpiry?.hitCount} (应不变,过期不命中不递增)`);

  // ═══ 测试 4: 数据一致性测试 ═══
  console.log("\n═══ 测试4: 数据一致性 ═══");
  // 重新插有效缓存
  await prisma.marketSearchCache.upsert({
    where: { keyword_category: { keyword: "рюкзак", category: "" } },
    create: {
      keyword: "рюкзак", category: "",
      result: mockRyzakProducts, productCount: 2, source: "apify",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    },
    update: {
      result: mockRyzakProducts, productCount: 2,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      hitCount: 0
    }
  });
  const t4 = await search(cookie, "backpack");
  // 从 HTML 提取所有 h3 标题（商品标题）
  const titles = [...t4.html ? [] : []]; // placeholder
  const htmlResp = await fetch(`${BASE}/research/ozon?mode=market&keyword=backpack`, { headers: { Cookie: cookie } });
  const html = await htmlResp.text();
  const allTitles = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]).filter(t => !t.includes("全站") && !t.includes("这里暂时"));
  const allPrices = [...html.matchAll(/research-product-foot[\s\S]*?<strong>(\d+)<\/strong>/g)].map(m => m[1]);
  results.consistency = {
    productsInHtml: allTitles.length,
    titles: allTitles,
    prices: allPrices,
    expectedTitles: mockRyzakProducts.map(p => p.title),
    expectedPrices: mockRyzakProducts.map(p => String(p.price))
  };
  console.log(`  HTML 商品标题: ${JSON.stringify(allTitles)}`);
  console.log(`  预期标题:      ${JSON.stringify(results.consistency.expectedTitles)}`);
  console.log(`  HTML 价格:     ${JSON.stringify(allPrices)}`);
  console.log(`  预期价格:      ${JSON.stringify(results.consistency.expectedPrices)}`);
  const titlesMatch = JSON.stringify(allTitles) === JSON.stringify(results.consistency.expectedTitles);
  const pricesMatch = JSON.stringify(allPrices) === JSON.stringify(results.consistency.expectedPrices);
  console.log(`  标题一致: ${titlesMatch ? "✅" : "❌"}  价格一致: ${pricesMatch ? "✅" : "❌"}`);

  // ═══ 汇总 ═══
  console.log("\n═══════════════════════════════════════");
  console.log("            压力测试汇总");
  console.log("═══════════════════════════════════════");
  console.log("\n【测试1 同关键词重复搜索 - 缓存命中】");
  console.log(`  第1次(命中): ${t1a.ms}ms`);
  console.log(`  第2次(命中): ${t1b.ms}ms`);
  console.log(`  第3次(命中): ${t1c.ms}ms`);
  console.log(`  hitCount: 0→${cacheAfter?.hitCount}`);
  console.log(`  缓存命中判定: ${t1a.fromCache && t1b.fromCache && t1c.fromCache ? "✅ 全部命中" : "❌"}`);

  console.log("\n【测试2 不同关键词搜索 - 未命中走 Apify】");
  console.log(`  serum:    ${t2a.ms}ms (${t2a.apifyErr ? "Apify失败(预期,dummy token)" : "?"})`);
  console.log(`  led lamp: ${t2b.ms}ms (${t2b.apifyErr ? "Apify失败(预期)" : "?"})`);
  console.log(`  dog toy:  ${t2c.ms}ms (${t2c.apifyErr ? "Apify失败(预期)" : "?"})`);
  console.log(`  失败时是否写缓存: ${!serumCache ? "✅ 不写(正确)" : "❌ 写了(异常)"}`);

  console.log("\n【测试3 缓存过期】");
  console.log(`  过期后搜索: ${t3.ms}ms fromCache=${t3.fromCache}`);
  console.log(`  过期判定: ${!t3.fromCache ? "✅ 过期缓存不命中" : "❌ 过期仍命中"}`);

  console.log("\n【测试4 数据一致性】");
  console.log(`  标题一致: ${titlesMatch ? "✅" : "❌"}`);
  console.log(`  价格一致: ${pricesMatch ? "✅" : "❌"}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
