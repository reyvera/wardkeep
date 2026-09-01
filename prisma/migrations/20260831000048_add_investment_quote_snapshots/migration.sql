CREATE TABLE "InvestmentQuoteSnapshot" (
  "id" TEXT NOT NULL,
  "holdingId" TEXT NOT NULL,
  "price" DECIMAL(19,4) NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "asOf" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestmentQuoteSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvestmentQuoteSnapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "InvestmentHolding"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InvestmentQuoteSnapshot_holdingId_asOf_idx" ON "InvestmentQuoteSnapshot"("holdingId", "asOf");

-- Preserve pre-history quote fields when they include a known observation date.
INSERT INTO "InvestmentQuoteSnapshot" ("id", "holdingId", "price", "source", "asOf", "createdAt")
SELECT "id" || '-initial-quote', "id", "quotePrice", COALESCE("quoteSource", 'Manual entry'), "quoteAsOf"::date, CURRENT_TIMESTAMP
FROM "InvestmentHolding"
WHERE "quotePrice" IS NOT NULL AND "quoteAsOf" IS NOT NULL;
