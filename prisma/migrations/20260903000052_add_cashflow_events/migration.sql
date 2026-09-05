CREATE TABLE "CashflowEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "type" "TransactionType" NOT NULL,
  "description" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashflowEvent_userId_accountId_date_idx" ON "CashflowEvent"("userId", "accountId", "date");

ALTER TABLE "CashflowEvent" ADD CONSTRAINT "CashflowEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashflowEvent" ADD CONSTRAINT "CashflowEvent_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
