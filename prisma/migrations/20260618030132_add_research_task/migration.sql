-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "productCount" INTEGER,
    "errorMessage" TEXT,
    "apifyRunId" TEXT,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchTask_userId_idx" ON "ResearchTask"("userId");

-- CreateIndex
CREATE INDEX "ResearchTask_status_idx" ON "ResearchTask"("status");

-- CreateIndex
CREATE INDEX "ResearchTask_keyword_idx" ON "ResearchTask"("keyword");

-- CreateIndex
CREATE INDEX "ResearchTask_keyword_category_status_idx" ON "ResearchTask"("keyword", "category", "status");

-- AddForeignKey
ALTER TABLE "ResearchTask" ADD CONSTRAINT "ResearchTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
