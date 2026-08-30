ALTER TABLE "ReadinessSnapshot"
  ADD COLUMN "modelVersion" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "ReadinessSnapshot_userId_recordedAt_key";

CREATE UNIQUE INDEX "ReadinessSnapshot_userId_recordedAt_modelVersion_key"
  ON "ReadinessSnapshot"("userId", "recordedAt", "modelVersion");

CREATE INDEX "ReadinessSnapshot_userId_modelVersion_recordedAt_idx"
  ON "ReadinessSnapshot"("userId", "modelVersion", "recordedAt");
