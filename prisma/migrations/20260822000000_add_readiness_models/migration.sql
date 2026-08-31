-- ReadinessSignal and ReadinessSnapshot were originally introduced through
-- development schema synchronization. Keep this migration before the existing
-- snapshot-link migration so a fresh `migrate deploy` has the prerequisite
-- tables and enum types. The guards make it safe for existing deployments
-- whose schema already contains these objects.

DO $$
BEGIN
  CREATE TYPE "SignalType" AS ENUM ('RISK', 'OPPORTUNITY', 'MILESTONE', 'WARNING', 'POSITIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReadinessPillarEnum" AS ENUM ('PROTECTION', 'PROVISION', 'PREPARATION', 'PROSPERITY', 'PEACE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReadinessSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "overall" INTEGER NOT NULL,
  "protection" INTEGER NOT NULL,
  "provision" INTEGER NOT NULL,
  "preparation" INTEGER NOT NULL,
  "prosperity" INTEGER NOT NULL,
  "peace" INTEGER NOT NULL,
  "recordedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReadinessSignal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capabilityId" VARCHAR(50) NOT NULL,
  "type" "SignalType" NOT NULL,
  "magnitude" INTEGER NOT NULL,
  "pillar" "ReadinessPillarEnum" NOT NULL,
  "summary" VARCHAR(500) NOT NULL,
  "weight" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReadinessSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReadinessSnapshot_userId_recordedAt_idx"
  ON "ReadinessSnapshot"("userId", "recordedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReadinessSnapshot_userId_recordedAt_key"
  ON "ReadinessSnapshot"("userId", "recordedAt");
CREATE INDEX IF NOT EXISTS "ReadinessSignal_userId_pillar_idx"
  ON "ReadinessSignal"("userId", "pillar");
CREATE INDEX IF NOT EXISTS "ReadinessSignal_userId_createdAt_idx"
  ON "ReadinessSignal"("userId", "createdAt");
