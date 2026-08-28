CREATE TABLE "HomeAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "installedAt" DATE,
  "expectedLifespanYears" INTEGER,
  "replacementCost" DECIMAL(19,4),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeAsset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HomeMaintenanceTask" (
  "id" TEXT NOT NULL,
  "homeAssetId" TEXT,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "dueDate" DATE,
  "completedAt" DATE,
  "estimatedCost" DECIMAL(19,4),
  "actualCost" DECIMAL(19,4),
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeMaintenanceTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HomeAsset_userId_isActive_idx" ON "HomeAsset"("userId", "isActive");
CREATE INDEX "HomeMaintenanceTask_userId_dueDate_idx" ON "HomeMaintenanceTask"("userId", "dueDate");
CREATE INDEX "HomeMaintenanceTask_homeAssetId_idx" ON "HomeMaintenanceTask"("homeAssetId");
ALTER TABLE "HomeAsset" ADD CONSTRAINT "HomeAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeMaintenanceTask" ADD CONSTRAINT "HomeMaintenanceTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeMaintenanceTask" ADD CONSTRAINT "HomeMaintenanceTask_homeAssetId_fkey" FOREIGN KEY ("homeAssetId") REFERENCES "HomeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
