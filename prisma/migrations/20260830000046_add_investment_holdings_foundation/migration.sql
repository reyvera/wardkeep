ALTER TYPE "AccountType" ADD VALUE 'BROKERAGE';
ALTER TYPE "AccountType" ADD VALUE 'RETIREMENT';
ALTER TYPE "AccountType" ADD VALUE 'CRYPTO';
ALTER TYPE "AccountType" ADD VALUE 'REAL_ESTATE';

CREATE TABLE "InvestmentHolding" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "symbol" VARCHAR(32) NOT NULL,
  "quantity" DECIMAL(24,8) NOT NULL,
  "costBasis" DECIMAL(19,4),
  "quotePrice" DECIMAL(19,4),
  "quoteSource" VARCHAR(80),
  "quoteAsOf" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentHolding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvestmentHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvestmentHolding_accountId_symbol_key" ON "InvestmentHolding"("accountId", "symbol");
CREATE INDEX "InvestmentHolding_symbol_idx" ON "InvestmentHolding"("symbol");
