CREATE TYPE "HouseholdTransitionContactRole" AS ENUM ('INCAPACITY_AGENT', 'POTENTIAL_EXECUTOR', 'SURVIVING_HOUSEHOLD_CONTACT');
CREATE TABLE "HouseholdTransitionContact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "HouseholdTransitionContactRole" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(254),
  "phone" VARCHAR(40),
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdTransitionContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HouseholdTransitionContact_userId_role_idx" ON "HouseholdTransitionContact"("userId", "role");
ALTER TABLE "HouseholdTransitionContact" ADD CONSTRAINT "HouseholdTransitionContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
