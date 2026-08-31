CREATE TABLE "ReadinessScoreChange" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "pillar" "ReadinessPillarEnum" NOT NULL,
  "previous" INTEGER NOT NULL,
  "current" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReadinessScoreChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReadinessScoreChange_snapshotId_pillar_key" UNIQUE ("snapshotId", "pillar"),
  CONSTRAINT "ReadinessScoreChange_snapshotId_fkey" FOREIGN KEY ("snapshotId")
    REFERENCES "ReadinessSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReadinessScoreChange_snapshotId_idx" ON "ReadinessScoreChange"("snapshotId");
