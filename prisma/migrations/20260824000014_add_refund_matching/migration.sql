ALTER TABLE "Transaction" ADD COLUMN "refundForTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "refundMatchedAt" TIMESTAMP(3);
CREATE INDEX "Transaction_userId_refundForTransactionId_idx" ON "Transaction"("userId", "refundForTransactionId");
