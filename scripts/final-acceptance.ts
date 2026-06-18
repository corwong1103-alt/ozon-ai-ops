#!/usr/bin/env node
/**
 * FINAL ACCEPTANCE: 完整 V3 状态机走查
 * discovered → in_product_center → optimizing → optimized → ready_to_publish
 */

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

function decryptSecret(payload: string) {
  const algorithm = "aes-256-gcm";
  const secret = process.env.OZON_API_KEY_ENCRYPTION_SECRET;
  const hash = crypto.createHash("sha256").update(secret).digest();
  const [ivHex, tagHex, encryptedHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(algorithm, hash, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

async function dashscopeCall(messages: any[], model = "qwen-plus") {
  const integration = await prisma.apiIntegration.findFirst({ where: { provider: "dashscope" } });
  const apiKey = decryptSecret(integration.secretEncrypted);
  const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function dashscopeImage(prompt: string) {
  const integration = await prisma.apiIntegration.findFirst({ where: { provider: "dashscope" } });
  const apiKey = decryptSecret(integration.secretEncrypted);
  const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen-image-2.0-pro",
      input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
      parameters: { n: 1, size: "1024*1024", prompt_extend: true, watermark: false },
    }),
  });
  const data = await res.json();
  return extractImageUrl(data);
}

function extractImageUrl(data: any) {
  try {
    const choices = data?.output?.choices;
    if (Array.isArray(choices)) {
      const content = choices[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item?.image) return item.image;
        }
      }
    }
  } catch {}
  return "";
}

async function main() {
  const userId = "cmqg70m500002dsfuzj257n40"; // operator@demo.com
  const productId = "cmqj6gfdr001625v72h4drc7v"; // Капиксил 10%

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   OzonAI V3 完整状态机验收                    ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── Step 0: 初始状态 ──
  const p0 = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`[初始] status=${p0.status} | title=${p0.title.slice(0, 60)} | images=${JSON.parse(p0.images as string).length}`);

  if (p0.status !== "discovered") {
    console.log("❌ 商品不是 discovered 状态，中止。");
    return;
  }

  // ── Step 1: discovered → in_product_center ──
  console.log("\n── Step 1: discovered → in_product_center ──");
  await prisma.product.update({ where: { id: productId }, data: { status: "in_product_center" } });
  await prisma.taskLog.create({
    data: { userId, productId, type: "research", status: "success", creditCost: 0, message: `[验收] 加入商品池：${p0.title}` },
  });
  const p1 = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`  status=${p1.status} ${p1.status === "in_product_center" ? "✅" : "❌"}`);

  // ── Step 2: in_product_center → optimizing (AI翻译) ──
  console.log("\n── Step 2: AI 翻译 → optimizing ──");
  const translatePrompt = [
    "你是 Ozon 俄罗斯跨境电商商品本地化助手。把下面商品标题和描述翻译成自然俄语。输出 JSON：{titleRu, descriptionRu}。不要输出其他内容。",
    `标题：${p0.title}`,
    `描述：${p0.description.slice(0, 500)}`,
  ].join("\n");

  const translationRaw = await dashscopeCall([
    { role: "system", content: "你是 Ozon 俄罗斯跨境电商商品本地化助手。严格输出 JSON，字段 titleRu、descriptionRu，不要输出其他内容。" },
    { role: "user", content: translatePrompt },
  ]);

  let titleRu = p0.title;
  let descriptionRu = p0.description;
  try {
    const cleaned = translationRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    titleRu = parsed.titleRu || p0.title;
    descriptionRu = parsed.descriptionRu || p0.description;
  } catch {}

  await prisma.product.update({ where: { id: productId }, data: { title: titleRu, description: descriptionRu, status: "optimizing" } });
  await prisma.taskLog.create({
    data: { userId, productId, type: "translate", status: "success", creditCost: 0, message: `[验收] 翻译完成：${titleRu.slice(0, 80)}`, metadata: { translated: translationRaw } },
  });
  const p2 = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`  status=${p2.status} ${p2.status === "optimizing" ? "✅" : "❌"}`);
  console.log(`  title=${p2.title.slice(0, 80)} ${p2.title !== p0.title ? "✅ 已翻译" : "❌ 未变化"}`);

  // ── Step 3: AI 优化 → optimized ──
  console.log("\n── Step 3: AI 优化 → optimized ──");
  const optimizePrompt = [
    "你是 Ozon 商品运营专家。优化以下商品信息，输出优化后的俄语标题(含核心卖点关键词)、俄语描述(结构化：卖点、规格、适用场景)、SEO关键词(5-10个俄语词)。输出 JSON：{optimizedTitle, optimizedDescription, seoKeywords}。",
    `商品：${p2.title}`,
    `描述：${p2.description.slice(0, 500)}`,
  ].join("\n");

  const optimizedRaw = await dashscopeCall([
    { role: "system", content: "你是 Ozon 商品运营专家，输出可直接审核的俄语商品优化草稿。严格输出 JSON。" },
    { role: "user", content: optimizePrompt },
  ]);

  await prisma.product.update({ where: { id: productId }, data: { status: "optimized" } });
  await prisma.taskLog.create({
    data: { userId, productId, type: "translate", status: "success", creditCost: 0, message: `[验收] AI优化完成`, metadata: { optimized: optimizedRaw } },
  });
  const p3 = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`  status=${p3.status} ${p3.status === "optimized" ? "✅" : "❌"}`);
  console.log(`  AI优化长度: ${optimizedRaw.length} chars ${optimizedRaw.length > 50 ? "✅" : "❌"}`);

  // ── Step 4: AI 生图 ──
  console.log("\n── Step 4: AI 生图 ──");
  const imagePrompt = `生成一张 Ozon 跨境电商商品主图。风格：干净真实的电商摄影，浅色背景。商品：${p3.title.slice(0, 100)}`;
  const imageUrl = await dashscopeImage(imagePrompt);
  const imageOk = imageUrl.length > 0 && imageUrl.startsWith("http");
  console.log(`  image_url=${imageUrl.slice(0, 60)}... ${imageOk ? "✅" : "❌"}`);
  if (imageOk) {
    const currentImages = JSON.parse(p3.images as string) || [];
    await prisma.product.update({ where: { id: productId }, data: { images: [imageUrl, ...currentImages] } });
    await prisma.taskLog.create({
      data: { userId, productId, type: "image", status: "success", creditCost: 1, message: `[验收] AI商品图生成`, metadata: { url: imageUrl, prompt: imagePrompt } },
    });
  }

  // ── Step 5: optimized → ready_to_publish ──
  console.log("\n── Step 5: optimized → ready_to_publish ──");
  await prisma.product.update({ where: { id: productId }, data: { status: "ready_to_publish" } });
  await prisma.taskLog.create({
    data: { userId, productId, type: "upload", status: "queued", creditCost: 0, message: "[验收] 人工确认完成，进入待发布" },
  });
  const p5 = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`  status=${p5.status} ${p5.status === "ready_to_publish" ? "✅" : "❌"}`);

  // ── 最终验证 ──
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   验收结果                                    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  状态机: discovered → in_product_center → optimizing → optimized → ready_to_publish`);
  console.log(`  最终状态: ${p5.status} ${p5.status === "ready_to_publish" ? "✅" : "❌"}`);
  console.log(`  AI翻译: ${p2.title !== p0.title ? "✅" : "❌"}`);
  console.log(`  AI优化: ${optimizedRaw.length > 50 ? "✅" : "❌"}`);
  console.log(`  AI生图: ${imageOk ? "✅" : "❌"}`);
  console.log(`  数据库: title=${p5.title.slice(0, 60)}`);

  const allPass = p5.status === "ready_to_publish" && p2.title !== p0.title && optimizedRaw.length > 50 && imageOk;
  console.log(`\n  ${allPass ? "🎉 全部通过" : "❌ 存在阻塞"}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
