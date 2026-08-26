ALTER TABLE "Recommendation"
  ADD COLUMN "estimatedAmount" DECIMAL(19,4),
  ADD COLUMN "estimatedMonthlyAmount" DECIMAL(19,4),
  ADD COLUMN "estimatedAmountLabel" VARCHAR(160),
  ADD COLUMN "estimatedCompletionDays" INTEGER;
