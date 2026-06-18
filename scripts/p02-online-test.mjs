// P0-2 线上真实测试（4 场景）
// 线上 http://47.239.96.230 有真实 Apify 配置
const BASE = "http://47.239.96.230";

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "demo123456" })
  });
  if (!r.ok) throw new Error(`login failed ${r.status}`);
  return r.headers.get("set-cookie")?.split(";")[0] || "";
}

async function createTask(cookie, keyword) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/research/task`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ keyword })
  });
  return { status: r.status, ms: Date.now() - t0, data: await r.json() };
}

async function pollTask(cookie, taskId, maxRounds = 30) {
  const t0 = Date.now();
  for (let i = 0; i < maxRounds; i++) {
    const r = await fetch(`${BASE}/api/research/task/${taskId}`, { headers: { Cookie: cookie } });
    const data = await r.json();
    if (data.status === "success" || data.status === "failed") {
      return { round: i, totalMs: Date.now() - t0, data };
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  return { round: maxRounds, totalMs: Date.now() - t0, data: { status: "TIMEOUT" } };
}

async function searchPage(cookie, keyword) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/research/ozon?mode=market&keyword=${encodeURIComponent(keyword)}`, {
    headers: { Cookie: cookie }
  });
  const html = await r.text();
  return {
    status: r.status, ms: Date.now() - t0,
    hasPoller: /正在调研市场/.test(html),
    hasCache: /从缓存读取/.test(html),
    hasProducts: /research-product-card/.test(html),
    productCount: (html.match(/research-product-card/g) || []).length
  };
}

async function retryTask(cookie, taskId) {
  const r = await fetch(`${BASE}/api/research/task/${taskId}`, { method: "POST", headers: { Cookie: cookie } });
  return { status: r.status, data: await r.json() };
}

async function main() {
  const cookie = await login();
  console.log("[login] OK\n");

  // ═══ 场景 1: 新关键词（真实 Apify 任务）═══
  console.log("═══ 场景1: 新关键词（真实 Apify）═══");
  // 用一个大概率没搜过的词
  const newWord = "power bank portable";
  const p1 = await searchPage(cookie, newWord);
  console.log(`  页面响应: ${p1.ms}ms (应 <500ms)  显示调研中: ${p1.hasPoller}`);
  // 创建任务并轮询到完成
  const t1 = await createTask(cookie, newWord);
  console.log(`  创建任务: ${t1.ms}ms taskId=${t1.data.taskId} reused=${t1.data.reused}`);
  const r1 = await pollTask(cookie, t1.data.taskId, 40);
  console.log(`  轮询完成: round=${r1.round} 耗时=${r1.totalMs}ms status=${r1.data.status}`);
  console.log(`  商品数: ${r1.data.productCount}  fromCache: ${r1.data.fromCache}`);
  if (r1.data.products?.length) {
    console.log(`  首个商品: ${r1.data.products[0].name?.slice(0,50)}  价格=${r1.data.products[0].price}`);
  }
  const s1Pass = p1.ms < 500 && p1.hasPoller && r1.data.status === "success" && r1.data.productCount > 0;
  console.log(`  判定: ${s1Pass ? "✅ 通过" : "❌ 失败"}\n`);

  // ═══ 场景 2: 缓存关键词（场景1 刚缓存，应秒开）═══
  console.log("═══ 场景2: 缓存关键词（刚搜过 power bank）═══");
  const p2a = await searchPage(cookie, newWord);
  const p2b = await searchPage(cookie, newWord);
  console.log(`  第1次: ${p2a.ms}ms  命中缓存: ${p2a.hasCache}  商品: ${p2a.productCount}`);
  console.log(`  第2次: ${p2b.ms}ms  命中缓存: ${p2b.hasCache}  商品: ${p2b.productCount}`);
  const s2Pass = p2a.hasCache && p2a.productCount > 0 && p2b.ms < 1000;
  console.log(`  判定: ${s2Pass ? "✅ 通过" : "❌ 失败"}\n`);

  // ═══ 场景 3: 多标签并发（同关键词复用 taskId）═══
  console.log("═══ 场景3: 多标签并发去重 ═══");
  const concurrentWord = "led desk lamp";
  const [c1, c2, c3] = await Promise.all([
    createTask(cookie, concurrentWord),
    createTask(cookie, concurrentWord),
    createTask(cookie, concurrentWord)
  ]);
  console.log(`  请求1: taskId=${c1.data.taskId} reused=${c1.data.reused}`);
  console.log(`  请求2: taskId=${c2.data.taskId} reused=${c2.data.reused}`);
  console.log(`  请求3: taskId=${c3.data.taskId} reused=${c3.data.reused}`);
  const sameTask = c1.data.taskId === c2.data.taskId && c2.data.taskId === c3.data.taskId;
  const reusedCount = [c1, c2, c3].filter(x => x.data.reused).length;
  console.log(`  同一 taskId: ${sameTask ? "✅" : "❌"}  reused数: ${reusedCount} (应=2)`);
  // 等并发任务完成（复用的会等第一个）
  const r3 = await pollTask(cookie, c1.data.taskId, 40);
  console.log(`  并发任务最终: status=${r3.data.status} 商品=${r3.data.productCount}`);
  const s3Pass = sameTask && reusedCount === 2;
  console.log(`  判定: ${s3Pass ? "✅ 通过" : "❌ 失败"}\n`);

  // ═══ 场景 4: 任务失败重试 ═══
  console.log("═══ 场景4: 任务失败重试 ═══");
  // 用一个会导致 Apify 返回空/失败的极端词（超长无意义字符串）
  const badWord = "zzzzzz_no_such_product_xxxxx_12345";
  const t4 = await createTask(cookie, badWord);
  console.log(`  创建任务: taskId=${t4.data.taskId}`);
  const r4a = await pollTask(cookie, t4.data.taskId, 40);
  console.log(`  首次结果: status=${r4a.data.status} 商品=${r4a.data.productCount} error=${(r4a.data.errorMessage||"").slice(0,60)}`);
  // 无论成功(0商品)或失败，测试重试机制
  const retry = await retryTask(cookie, t4.data.taskId);
  console.log(`  重试响应: ${retry.status} ${JSON.stringify(retry.data)}`);
  const r4b = await pollTask(cookie, t4.data.taskId, 40);
  console.log(`  重试后: status=${r4b.data.status} 商品=${r4b.data.productCount}`);
  const s4Pass = retry.data.ok && (r4b.data.status === "success" || r4b.data.status === "failed");
  console.log(`  判定: ${s4Pass ? "✅ 通过" : "❌ 失败"}\n`);

  // ═══ 汇总 ═══
  console.log("═══════════════════════════════════════");
  console.log("        线上测试汇总");
  console.log("═══════════════════════════════════════");
  console.log(`场景1 新关键词(真实Apify): ${s1Pass ? "✅" : "❌"}  页面${p1.ms}ms / 任务${r1.totalMs}ms / ${r1.data.productCount}商品`);
  console.log(`场景2 缓存关键词秒开:    ${s2Pass ? "✅" : "❌"}  ${p2b.ms}ms`);
  console.log(`场景3 多标签并发去重:    ${s3Pass ? "✅" : "❌"}  reused=${reusedCount}`);
  console.log(`场景4 失败重试:          ${s4Pass ? "✅" : "❌"}`);
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
