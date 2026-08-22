CREATE TYPE "InsurancePaymentArrangement" AS ENUM ('SEPARATE', 'MORTGAGE_ESCROW', 'LOAN_OR_LEASE', 'OTHER_BUNDLED');

ALTER TABLE "InsurancePolicy"
  ADD COLUMN "paymentArrangement" "InsurancePaymentArrangement" NOT NULL DEFAULT 'SEPARATE',
  ADD COLUMN "paymentAccountId" TEXT,
  ADD COLUMN "propertyTaxEscrow" DECIMAL(19,4),
  ADD COLUMN "propertyTaxFrequency" "InsurancePremiumFrequency";

ALTER TABLE "InsurancePolicy"
  ADD CONSTRAINT "InsurancePolicy_paymentAccountId_fkey"
  FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InsurancePolicy_paymentAccountId_idx" ON "InsurancePolicy"("paymentAccountId");
