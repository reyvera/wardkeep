CREATE TYPE "HouseholdMembershipRole" AS ENUM ('MEMBER', 'SURVIVING_HOUSEHOLD_LEAD');

CREATE TABLE "Household" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Household_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Household_ownerUserId_key" UNIQUE ("ownerUserId"),
  CONSTRAINT "Household_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "HouseholdMembership" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "HouseholdMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HouseholdMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HouseholdMembership_userId_key" UNIQUE ("userId"),
  CONSTRAINT "HouseholdMembership_householdId_userId_key" UNIQUE ("householdId", "userId"),
  CONSTRAINT "HouseholdMembership_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HouseholdMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "TrustedAccessInvitation" ADD COLUMN "householdId" TEXT;
ALTER TABLE "TrustedAccessInvitation" ADD CONSTRAINT "TrustedAccessInvitation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TrustedAccessInvitation_householdId_idx" ON "TrustedAccessInvitation"("householdId");
