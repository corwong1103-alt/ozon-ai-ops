-- P3: ProductStatus enum 迁移到 V3 商品生命周期
-- 重建 type 方案（支持多旧值合并到同新值，事务安全）
-- 映射：draft→discovered, translated/image_generated→optimizing, video_generated→optimized, uploaded→published
-- 新增：favorited, ready_to_publish, promoted

CREATE TYPE "ProductStatus_new" AS ENUM ('discovered', 'favorited', 'optimizing', 'optimized', 'ready_to_publish', 'published', 'promoted');

ALTER TABLE "Product" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Product" ALTER COLUMN "status" TYPE "ProductStatus_new" USING (
  CASE "status"::text
    WHEN 'draft' THEN 'discovered'::"ProductStatus_new"
    WHEN 'translated' THEN 'optimizing'::"ProductStatus_new"
    WHEN 'image_generated' THEN 'optimizing'::"ProductStatus_new"
    WHEN 'video_generated' THEN 'optimized'::"ProductStatus_new"
    WHEN 'uploaded' THEN 'published'::"ProductStatus_new"
    ELSE 'discovered'::"ProductStatus_new"
  END
);

ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'discovered';

DROP TYPE "ProductStatus";

ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
