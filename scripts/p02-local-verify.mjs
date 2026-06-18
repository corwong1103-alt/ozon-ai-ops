// P0-2 ResearchTask 本地验证（4 场景）
// dummy Apify token → 未命中任务会走 Apify 401 失败，测完整任务生命周期
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

const mockProducts = [
  {
    externalId: "10675173995", title: "Рюкзак HV379 черный", price: 494, currency: "RUB",
    imageUrl: "https://ir.ozone.ru/s3/multimedia-1-z/10675173995.jpg",
    images: ["https://ir.ozone.ru/s3/multimedia-1-z/10675173995.jpg"],
    rating: 4.8, reviewCount: 123, seller: "HV379", productUrl: "https://www.ozon.ru/product/10675173995/", category: "fashion"
  }
];

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "demo123456" })
  });
  return r.headers.get("set-cookie")?.split(";")[0] || "";
}

async function createTask(cookie, keyword, categoryId) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/research/task`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ keyword, categoryId })
  });
  const ms = Date.now() - t0;
  const data = await r.json();
  return { status: r.status, ms, data };
}

async function pollTask(cookie, taskId, maxRounds = 15) {
  for (let i = 0; i < maxRounds; i++) {
    const r = await fetch(`${BASE}/api/research/task/${taskId}`, { headers: { Cookie: cookie } });
    const data = await r.json();
    if (data.status === "success" || data.status === "failed") return { round: i, data };
    await new Promise(res => setTimeout(res, 1000));
  }
  return { round: maxRounds, data: { status: "TIMEOUT" } };
}

async function retryTask(cookie, taskId) {
  const r = await fetch(`${BASE}/api/research/task/${taskId}`, {
    method: "POST", headers: { Cookie: cookie }
  });
  return { status: r.status, data: await r.json() };
}

async function searchPage(cookie, keyword) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/research/ozon?mode=market&keyword=${encodeURIComponent(keyword)}`, {
    headers: { Cookie: cookie }
  });
  const html = await r.text();
  const ms = Date.now() - t0;
  const hasPoller = /正在调研市场/.test(html);
  const hasCache = /从缓存读取/.test(html);
  const hasProducts = /research-product-card/.test(html);
  const taskIdMatch = html.match(/taskId=([a-z0-9]+)/i); // 可能不存在
  return { status: r.status, ms, hasPoller, hasCache, hasProducts, htmlLen: html.length };
}

async function main() {
  const cookie = await login();
  // 清场
  await prisma.researchTask.deleteMany({});
  await prisma.marketSearchCache.deleteMany({});
  console.log("=== 清场完成 ===\n");

  // ═══ 场景 A: 缓存命中 SSR 直出（<500ms，无 taskId）═══
  console.log("═══ 场景A: 缓存命中 SSR 直出 ═══");
  await prisma.marketSearchCache.create({
    data: {
      keyword: "рюкзак", category: "",
      result: mockProducts, productCount: 1, source: "apify",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    }
  });
  const a = await searchPage(cookie, "backpack");
  console.log(`  页面耗时: ${a.ms}ms (应 <500ms)`);
  console.log(`  命中缓存: ${a.hasCache}  显示商品: ${a.hasProducts}  显示调研中: ${a.hasPoller}`);
  console.log(`  判定: ${a.ms < 500 && a.hasCache && a.hasProducts && !a.hasPoller ? "✅ 通过" : "❌ 失败"}\n`);

  // ═══ 场景 B: 新关键词创建任务（<500ms 返回 + 轮询失败 + 重试）═══
  console.log("═══ 场景B: 新关键词创建任务 ═══");
  const b1 = await createTask(cookie, "serum_test_new");
  console.log(`  创建任务耗时: ${b1.ms}ms (应 <500ms)  taskId=${b1.data.taskId}  reused=${b1.data.reused}`);
  const b2 = await pollTask(cookie, b1.data.taskId, 20);
  console.log(`  轮询结果: round=${b2.round} status=${b2.data.status} errorMessage=${(b2.data.errorMessage||"").slice(0,60)}`);
  console.log(`  任务失败判定: ${b2.data.status === "failed" ? "✅" : "❌"}`);
  // 重试
  const b3 = await retryTask(cookie, b1.data.taskId);
  console.log(`  重试响应: ${b3.status} ${JSON.stringify(b3.data)}`);
  // 重试后轮询
  const b4 = await pollTask(cookie, b1.data.taskId, 20);
  console.log(`  重试后轮询: status=${b4.data.status}`);
  console.log(`  重试判定: ${b3.data.ok && b4.data.status === "failed" ? "✅ 重新执行" : "❌"}\n`);

  // ═══ 场景 C: 多标签并发（同关键词复用 taskId）═══
  console.log("═══ 场景C: 多标签并发去重 ═══");
  await prisma.researchTask.deleteMany({ where: { keyword: "serum_test_new" } });
  // 并发 3 个相同请求
  const [c1, c2, c3] = await Promise.all([
    createTask(cookie, "concurrent_test"),
    createTask(cookie, "concurrent_test"),
    createTask(cookie, "concurrent_test")
  ]);
  console.log(`  请求1: taskId=${c1.data.taskId} reused=${c1.data.reused}`);
  console.log(`  请求2: taskId=${c2.data.taskId} reused=${c2.data.reused}`);
  console.log(`  请求3: taskId=${c3.data.taskId} reused=${c3.data.reused}`);
  const sameTask = c1.data.taskId === c2.data.taskId && c2.data.taskId === c3.data.taskId;
  const reusedCount = [c1, c2, c3].filter(x => x.data.reused).length;
  console.log(`  同一 taskId: ${sameTask ? "✅" : "❌"}  reused 数量: ${reusedCount} (应=2)`);
  // 检查 DB 只创建 1 个任务
  const dbTasks = await prisma.researchTask.findMany({ where: { keyword: "concurrent_test" } });
  console.log(`  DB 任务数: ${dbTasks.length} (应=1)  判定: ${sameTask && dbTasks.length === 1 ? "✅" : "❌"}\n`);

  // ═══ 场景 D: 任务成功数据链路（手动插 success 任务验证 API 返回）═══
  console.log("═══ 场景D: 任务成功数据链路 ═══");
  const successTask = await prisma.researchTask.create({
    data: {
      userId: (await prisma.user.findUnique({ where: { email: "admin@demo.com" } })).id,
      keyword: "success_test", category: "", status: "success",
      result: mockProducts, productCount: 1, fromCache: false
    }
  });
  const d = await fetch(`${BASE}/api/research/task/${successTask.id}`, { headers: { Cookie: cookie } });
  const dData = await d.json();
  console.log(`  API status: ${d.status}`);
  console.log(`  任务 status: ${dData.status}  productCount: ${dData.productCount}  products.length: ${dData.products?.length}`);
  console.log(`  首个商品标题: ${dData.products?.[0]?.name || "(无)"}`);
  console.log(`  判定: ${dData.status === "success" && dData.products?.length === 1 ? "✅" : "❌"}\n`);

  // ═══ 汇总 ═══
  console.log("═══════════════════════════════════");
  console.log("         本地验证汇总");
  console.log("═══════════════════════════════════");
  console.log(`A 缓存命中 SSR: ${a.ms < 500 && a.hasCache ? "✅" : "❌"} (${a.ms}ms)`);
  console.log(`B 新词任务+失败+重试: ${b2.data.status === "failed" && b3.data.ok ? "✅" : "❌"}`);
  console.log(`C 并发去重: ${sameTask && dbTasks.length === 1 ? "✅" : "❌"}`);
  console.log(`D 成功数据链路: ${dData.status === "success" && dData.products?.length === 1 ? "✅" : "❌"}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
