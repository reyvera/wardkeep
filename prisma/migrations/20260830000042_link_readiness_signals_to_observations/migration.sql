ALTER TABLE "ReadinessSignal" ADD COLUMN "observationId" TEXT;

ALTER TABLE "ReadinessSignal"
  ADD CONSTRAINT "ReadinessSignal_observationId_fkey"
  FOREIGN KEY ("observationId") REFERENCES "ReadinessObservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReadinessSignal_observationId_idx" ON "ReadinessSignal"("observationId");
