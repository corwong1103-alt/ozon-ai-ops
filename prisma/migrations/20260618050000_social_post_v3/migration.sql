-- P6: SocialPostStatus 迁移到 V3 5 阶段 + failed + 加 scheduledAt/publishedAt
CREATE TYPE "SocialPostStatus_new" AS ENUM ('draft', 'pending_review', 'ready', 'published', 'scheduled', 'failed');

ALTER TABLE "SocialPost" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SocialPost" ALTER COLUMN "status" TYPE "SocialPostStatus_new" USING (
  CASE "status"::text
    WHEN 'draft' THEN 'draft'::"SocialPostStatus_new"
    WHEN 'queued' THEN 'ready'::"SocialPostStatus_new"
    WHEN 'published' THEN 'published'::"SocialPostStatus_new"
    WHEN 'failed' THEN 'failed'::"SocialPostStatus_new"
    ELSE 'draft'::"SocialPostStatus_new"
  END
);
ALTER TABLE "SocialPost" ALTER COLUMN "status" SET DEFAULT 'draft';
DROP TYPE "SocialPostStatus";
ALTER TYPE "SocialPostStatus_new" RENAME TO "SocialPostStatus";

ALTER TABLE "SocialPost" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "SocialPost" ADD COLUMN "publishedAt" TIMESTAMP(3);
CREATE INDEX "SocialPost_status_idx" ON "SocialPost"("status");
