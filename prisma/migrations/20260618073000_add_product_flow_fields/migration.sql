ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "offerId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "researchKeyword" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CNY';

CREATE INDEX IF NOT EXISTS "Product_source_idx" ON "Product"("source");
CREATE INDEX IF NOT EXISTS "Product_sourceProductId_idx" ON "Product"("sourceProductId");
