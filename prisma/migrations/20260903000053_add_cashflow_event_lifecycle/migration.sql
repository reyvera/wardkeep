ALTER TABLE "CashflowEvent"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "completedAt" TIMESTAMP(3);

DROP INDEX "CashflowEvent_userId_accountId_date_idx";
CREATE INDEX "CashflowEvent_userId_accountId_isActive_date_idx"
  ON "CashflowEvent"("userId", "accountId", "isActive", "date");
