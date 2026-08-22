ALTER TABLE "ReadinessSignal" ADD COLUMN "snapshotId" TEXT;
CREATE INDEX "ReadinessSignal_snapshotId_idx" ON "ReadinessSignal"("snapshotId");
ALTER TABLE "ReadinessSignal" ADD CONSTRAINT "ReadinessSignal_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "ReadinessSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
