ALTER TABLE "Recommendation"
  ADD COLUMN "impactPreview" VARCHAR(1500) NOT NULL DEFAULT 'Wardkeep cannot reliably project a numeric score change from this action yet.',
  ADD COLUMN "projectedPillarDelta" INTEGER;
