CREATE TABLE "DailyBrief" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "briefingDate" DATE NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyBrief_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyBrief" ADD CONSTRAINT "DailyBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DailyBrief_userId_briefingDate_key" ON "DailyBrief"("userId", "briefingDate");
CREATE INDEX "DailyBrief_userId_briefingDate_idx" ON "DailyBrief"("userId", "briefingDate");
