CREATE TABLE "AdvisorInsight" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fingerprint" VARCHAR(191) NOT NULL,
  "summary" VARCHAR(1500) NOT NULL,
  "action" VARCHAR(240) NOT NULL,
  "actionHref" VARCHAR(240) NOT NULL,
  "sourceCapabilities" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdvisorInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisorInsight_userId_fingerprint_createdAt_idx"
  ON "AdvisorInsight"("userId", "fingerprint", "createdAt");
CREATE INDEX "AdvisorInsight_userId_createdAt_idx" ON "AdvisorInsight"("userId", "createdAt");

ALTER TABLE "AdvisorInsight"
  ADD CONSTRAINT "AdvisorInsight_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
