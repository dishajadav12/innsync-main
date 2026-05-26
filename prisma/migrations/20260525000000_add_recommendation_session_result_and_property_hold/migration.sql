-- AlterTable: city may already exist in production (added outside migrations); guard with IF NOT EXISTS
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "isOnHold" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RecommendationSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "preferences" JSONB NOT NULL,
    "totalAnalyzed" INTEGER NOT NULL,
    "topMatchReason" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    "status" TEXT NOT NULL DEFAULT 'active',
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "matchReasons" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "concerns" JSONB NOT NULL,
    "reviewInsights" JSONB NOT NULL,
    "budgetFit" JSONB NOT NULL,
    "amenityMatch" JSONB NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationSession_profileId_idx" ON "RecommendationSession"("profileId");

-- CreateIndex
CREATE INDEX "RecommendationSession_status_idx" ON "RecommendationSession"("status");

-- CreateIndex
CREATE INDEX "RecommendationSession_createdAt_idx" ON "RecommendationSession"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendationSession_profileId_status_idx" ON "RecommendationSession"("profileId", "status");

-- CreateIndex
CREATE INDEX "RecommendationResult_sessionId_idx" ON "RecommendationResult"("sessionId");

-- CreateIndex
CREATE INDEX "RecommendationResult_propertyId_idx" ON "RecommendationResult"("propertyId");

-- CreateIndex
CREATE INDEX "RecommendationResult_sessionId_rank_idx" ON "RecommendationResult"("sessionId", "rank");

-- AddForeignKey
ALTER TABLE "RecommendationSession" ADD CONSTRAINT "RecommendationSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("clerkId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
