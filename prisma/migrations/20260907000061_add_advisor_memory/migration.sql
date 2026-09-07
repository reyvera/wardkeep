CREATE TYPE "AdvisorMemoryKind" AS ENUM ('USER_PREFERENCE', 'ANNUAL_EVENT', 'SEASONAL_PATTERN', 'RECOMMENDATION_OUTCOME');

CREATE TABLE "AdvisorMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AdvisorMemoryKind" NOT NULL,
  "summary" VARCHAR(1000) NOT NULL,
  "sourceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorMemory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdvisorMemory" ADD CONSTRAINT "AdvisorMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AdvisorMemory_userId_kind_observedAt_idx" ON "AdvisorMemory"("userId", "kind", "observedAt");
CREATE INDEX "AdvisorMemory_userId_expiresAt_idx" ON "AdvisorMemory"("userId", "expiresAt");
