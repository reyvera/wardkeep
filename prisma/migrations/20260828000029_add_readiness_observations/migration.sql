CREATE TABLE "ReadinessObservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capabilityId" VARCHAR(100) NOT NULL,
  "fact" VARCHAR(240) NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" DECIMAL(3, 2) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "snapshotId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReadinessObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReadinessObservation_userId_capabilityId_observedAt_idx" ON "ReadinessObservation"("userId", "capabilityId", "observedAt");
CREATE INDEX "ReadinessObservation_snapshotId_idx" ON "ReadinessObservation"("snapshotId");
ALTER TABLE "ReadinessObservation" ADD CONSTRAINT "ReadinessObservation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ReadinessSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
