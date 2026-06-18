-- BACKUP: Ozon 商品 sourceProductId/offerId 回填前数据快照
-- 生成时间：2026-06-19
-- 执行前：psql $DATABASE_URL -f scripts/BACKUP_SOURCE_MAPPING.sql

BEGIN;

CREATE TEMP TABLE _backup_ozon_products_20260619 AS
SELECT id, title, status, source, "sourceProductId", "offerId", description, "createdAt", "updatedAt"
FROM "Product"
WHERE "source" = 'ozon' AND "sourceProductId" IS NULL;

-- 预计 12-13 行
SELECT count(*) AS backed_up_rows FROM _backup_ozon_products_20260619;

COMMIT;

-- 恢复命令（如需回滚）：
-- UPDATE "Product" p SET
--   "sourceProductId" = b."sourceProductId",
--   "offerId" = b."offerId"
-- FROM _backup_ozon_products_20260619 b
-- WHERE p.id = b.id;
