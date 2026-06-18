#!/usr/bin/env node
/**
 * 回填 Ozon 商品 sourceProductId / offerId
 * 从 description 文本字段中正则提取真实 Ozon ID
 *
 * 用法：cd ~/Documents/ozon && npx tsx scripts/backfill-source-ids.ts
 *
 * 前置：PostgreSQL @ localhost:5433 必须运行中
 * 影响：12-13 行（仅 source=ozon 且 sourceProductId IS NULL 的商品）
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("=== Ozon 商品 sourceProductId / offerId 回填 ===\n");

  // ── Step 1: 查询受影响商品 ──
  const products = await prisma.product.findMany({
    where: { source: "ozon", sourceProductId: null },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`受影响商品：${products.length} 件\n`);

  // ── Step 2: 从 description 提取 ID ──
  const toUpdate: Array<{
    id: string;
    title: string;
    sourceProductId: string;
    offerId: string | null;
  }> = [];

  let skipped = 0;
  for (const p of products) {
    const pidMatch = p.description.match(/Ozon Product ID: (\d+)/);
    const oidMatch = p.description.match(/Offer ID: (.+)/);

    if (!pidMatch) {
      console.log(`  ⏭ SKIP: ${p.title.slice(0, 40)} — description 中无 Product ID`);
      skipped++;
      continue;
    }

    const sourceProductId = pidMatch[1];
    const offerId = oidMatch ? oidMatch[1].trim() : null;

    toUpdate.push({
      id: p.id,
      title: p.title,
      sourceProductId,
      offerId,
    });

    console.log(`  ✅ ${p.id.slice(0, 14)}... | PID=${sourceProductId.padEnd(8)} | OID=${(offerId || "NULL").padEnd(16)} | ${p.title.slice(0, 50)}`);
  }

  console.log(`\n预计修改：${toUpdate.length} 件（跳过 ${skipped} 件）\n`);

  if (toUpdate.length === 0) {
    console.log("无需要回填的商品，退出。");
    await prisma.$disconnect();
    return;
  }

  // ── Step 3: 执行回填 ──
  console.log("执行回填...\n");

  let updated = 0;
  for (const item of toUpdate) {
    await prisma.product.update({
      where: { id: item.id },
      data: {
        sourceProductId: item.sourceProductId,
        offerId: item.offerId,
      },
    });
    updated++;
  }

  console.log(`已更新：${updated} 件\n`);

  // ── Step 4: 验证 ──
  const remainingNull = await prisma.product.count({
    where: { source: "ozon", sourceProductId: null },
  });

  const remainingNullOfferId = await prisma.product.count({
    where: { source: "ozon", offerId: null },
  });

  console.log("=== 验证结果 ===");
  console.log(`sourceProductId IS NULL: ${remainingNull} ${remainingNull === 0 ? "✅" : "❌"}`);
  console.log(`offerId IS NULL:       ${remainingNullOfferId} ${remainingNullOfferId === 0 ? "✅" : "❌ (mock 商品无真实 Offer ID 属于正常)"}`);

  // ── Step 5: 随机抽样 ──
  const sample = await prisma.product.findMany({
    where: { source: "ozon", sourceProductId: { not: null } },
    select: { title: true, sourceProductId: true, offerId: true },
    take: 5,
    orderBy: { updatedAt: "desc" },
  });

  console.log("\n=== 随机抽样验证（5 件）===");
  for (const p of sample) {
    console.log(`  ${p.title.slice(0, 45).padEnd(48)} | PID=${p.sourceProductId?.padEnd(10)} | OID=${p.offerId || "NULL"}`);
  }

  await prisma.$disconnect();
  console.log("\n回填完成。");
}

main().catch((e) => {
  console.error("回填失败:", e.message);
  process.exit(1);
});
