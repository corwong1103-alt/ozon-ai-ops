-- CreateTable
CREATE TABLE "MarketSearchCache" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT,
    "result" JSONB NOT NULL,
    "productCount" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'apify',
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSearchCache_keyword_idx" ON "MarketSearchCache"("keyword");

-- CreateIndex
CREATE INDEX "MarketSearchCache_expiresAt_idx" ON "MarketSearchCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSearchCache_keyword_category_key" ON "MarketSearchCache"("keyword", "category");
