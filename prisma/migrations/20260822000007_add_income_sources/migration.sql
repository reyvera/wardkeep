CREATE TYPE "IncomeFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE "IncomeSourceKind" AS ENUM ('EMPLOYMENT', 'SELF_EMPLOYMENT', 'BENEFIT', 'SUPPORT', 'OTHER');
CREATE TABLE "IncomeSource" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" VARCHAR(100) NOT NULL,
  "kind" "IncomeSourceKind" NOT NULL DEFAULT 'EMPLOYMENT', "frequency" "IncomeFrequency" NOT NULL,
  "expectedNetAmount" DECIMAL(19,4), "nextExpectedDate" DATE, "reviewDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IncomeSource_userId_isActive_idx" ON "IncomeSource"("userId", "isActive");
CREATE INDEX "IncomeSource_userId_reviewDate_idx" ON "IncomeSource"("userId", "reviewDate");
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
