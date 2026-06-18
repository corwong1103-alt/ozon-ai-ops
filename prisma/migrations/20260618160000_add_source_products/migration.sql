-- 1688 / 跨平台采集源商品中立存储层
-- 与 Product（内部商品池）解耦：搜索结果先落 SourceProduct，确认后才转 Product
-- 唯一约束 source + sourceProductId 防重复导入

CREATE TABLE "SourceProduct" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "supplier" TEXT,
    "supplierLevel" TEXT,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(4,2),
    "productUrl" TEXT,
    "researchKeyword" TEXT,
    "importedBy" TEXT,
    "importedProductId" TEXT,
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceProduct_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：同一源平台同一商品 ID 只能存一条
CREATE UNIQUE INDEX "SourceProduct_source_sourceProductId_key"
    ON "SourceProduct"("source", "sourceProductId");

CREATE INDEX "SourceProduct_source_idx" ON "SourceProduct"("source");
CREATE INDEX "SourceProduct_sourceProductId_idx" ON "SourceProduct"("sourceProductId");
CREATE INDEX "SourceProduct_importedBy_idx" ON "SourceProduct"("importedBy");
CREATE INDEX "SourceProduct_researchKeyword_idx" ON "SourceProduct"("researchKeyword");
