-- Existing transactions are treated as already reviewed. New imported or synced
-- transactions explicitly opt into the review inbox at creation time.
ALTER TABLE "Transaction" ADD COLUMN "isReviewed" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Transaction_userId_isReviewed_date_idx" ON "Transaction"("userId", "isReviewed", "date");
