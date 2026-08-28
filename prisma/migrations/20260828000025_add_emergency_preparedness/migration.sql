CREATE TYPE "EmergencyPreparednessCategory" AS ENUM ('FOOD', 'WATER', 'FIRST_AID', 'IMPORTANT_DOCUMENTS', 'EVACUATION_PLAN', 'OTHER');
CREATE TABLE "EmergencyPreparednessItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "EmergencyPreparednessCategory" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "reviewDate" DATE,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyPreparednessItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmergencyPreparednessItem_userId_category_idx" ON "EmergencyPreparednessItem"("userId", "category");
CREATE INDEX "EmergencyPreparednessItem_userId_reviewDate_idx" ON "EmergencyPreparednessItem"("userId", "reviewDate");
ALTER TABLE "EmergencyPreparednessItem" ADD CONSTRAINT "EmergencyPreparednessItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
