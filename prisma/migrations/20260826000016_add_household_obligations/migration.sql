CREATE TABLE "HouseholdObligation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "monthlyAmount" DECIMAL(19,4) NOT NULL,
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "reviewDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdObligation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HouseholdObligation_userId_isActive_idx" ON "HouseholdObligation"("userId", "isActive");
CREATE INDEX "HouseholdObligation_userId_reviewDate_idx" ON "HouseholdObligation"("userId", "reviewDate");

ALTER TABLE "HouseholdObligation"
ADD CONSTRAINT "HouseholdObligation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
