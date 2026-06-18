ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'in_product_center' AFTER 'favorited';
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'archived' AFTER 'promoted';
