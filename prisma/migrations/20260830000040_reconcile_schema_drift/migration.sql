DROP INDEX IF EXISTS "ReadinessSnapshot_userId_recordedAt_idx";

DROP INDEX IF EXISTS "SavedPayoffPlan_userId_idx";
ALTER TABLE "SavedPayoffPlan"
  ALTER COLUMN "name" TYPE VARCHAR(100),
  ALTER COLUMN "strategy" TYPE VARCHAR(20);
CREATE INDEX IF NOT EXISTS "SavedPayoffPlan_userId_createdAt_idx"
  ON "SavedPayoffPlan"("userId", "createdAt");
