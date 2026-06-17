CREATE TYPE "IntegrationProvider" AS ENUM ('dashscope', 'source_1688', 'vk', 'wibus');

CREATE TYPE "IntegrationStatus" AS ENUM ('configured', 'disconnected', 'error');

CREATE TABLE "ApiIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'configured',
    "accountLabel" TEXT,
    "publicConfig" JSONB NOT NULL DEFAULT '{}',
    "secretEncrypted" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiIntegration_userId_provider_key" ON "ApiIntegration"("userId", "provider");

CREATE INDEX "ApiIntegration_userId_idx" ON "ApiIntegration"("userId");

CREATE INDEX "ApiIntegration_provider_idx" ON "ApiIntegration"("provider");

ALTER TABLE "ApiIntegration" ADD CONSTRAINT "ApiIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
