CREATE TYPE "HouseholdTransitionMode" AS ENUM ('INCAPACITY_CONTINUITY', 'AFTER_DEATH_SETTLEMENT');
CREATE TABLE "HouseholdTransitionPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "HouseholdTransitionMode" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "reviewDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdTransitionPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HouseholdTransitionPlan_userId_mode_isActive_idx" ON "HouseholdTransitionPlan"("userId", "mode", "isActive");
ALTER TABLE "HouseholdTransitionPlan" ADD CONSTRAINT "HouseholdTransitionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
