CREATE TYPE "InsurancePolicyType" AS ENUM ('AUTO', 'HOME', 'RENTERS', 'HEALTH', 'LIFE', 'DISABILITY', 'UMBRELLA', 'OTHER');
CREATE TYPE "InsurancePremiumFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

CREATE TABLE "InsurancePolicy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "InsurancePolicyType" NOT NULL,
  "provider" VARCHAR(160) NOT NULL,
  "nickname" VARCHAR(100),
  "premium" DECIMAL(19,4),
  "premiumFrequency" "InsurancePremiumFrequency" NOT NULL DEFAULT 'MONTHLY',
  "deductible" DECIMAL(19,4),
  "coverageAmount" DECIMAL(19,4),
  "renewalDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "InsurancePolicy_userId_isActive_idx" ON "InsurancePolicy"("userId", "isActive");
CREATE INDEX "InsurancePolicy_userId_renewalDate_idx" ON "InsurancePolicy"("userId", "renewalDate");
