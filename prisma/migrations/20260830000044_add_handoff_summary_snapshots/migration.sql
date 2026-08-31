CREATE TABLE "HandoffSummary" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sharedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoffSummary_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoffSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HandoffSummary_userId_sharedAt_createdAt_idx" ON "HandoffSummary"("userId", "sharedAt", "createdAt");
