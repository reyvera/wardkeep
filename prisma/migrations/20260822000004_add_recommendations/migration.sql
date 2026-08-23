CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'COMPLETED', 'RESOLVED');

CREATE TABLE "Recommendation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fingerprint" VARCHAR(191) NOT NULL,
  "capabilityId" VARCHAR(100) NOT NULL,
  "pillar" VARCHAR(30) NOT NULL,
  "signalSummary" VARCHAR(1000) NOT NULL,
  "action" VARCHAR(240) NOT NULL,
  "actionHref" VARCHAR(240) NOT NULL,
  "reasoning" VARCHAR(1500) NOT NULL,
  "priority" VARCHAR(20) NOT NULL,
  "priorityScore" INTEGER NOT NULL,
  "assumptions" VARCHAR(1500) NOT NULL,
  "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
  "dismissedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Recommendation_userId_fingerprint_key" ON "Recommendation"("userId", "fingerprint");
CREATE INDEX "Recommendation_userId_status_priorityScore_idx" ON "Recommendation"("userId", "status", "priorityScore");
