/*
  Warnings:

  - Made the column `category` on table `MarketSearchCache` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MarketSearchCache" ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "category" SET DEFAULT '';
