CREATE TABLE "FinancialGoal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "targetAmount" DECIMAL(19,4),
  "savedAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "targetDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialGoal_userId_isActive_idx" ON "FinancialGoal"("userId", "isActive");
CREATE INDEX "FinancialGoal_userId_targetDate_idx" ON "FinancialGoal"("userId", "targetDate");

ALTER TABLE "FinancialGoal"
  ADD CONSTRAINT "FinancialGoal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
