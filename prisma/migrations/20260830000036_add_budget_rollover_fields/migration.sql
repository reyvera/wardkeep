ALTER TABLE "BudgetAllocation"
  ADD COLUMN "rolloverEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rolloverAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
