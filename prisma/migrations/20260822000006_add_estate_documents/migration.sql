CREATE TYPE "EstateDocumentType" AS ENUM (
  'WILL',
  'TRUST',
  'FINANCIAL_POWER_OF_ATTORNEY',
  'HEALTHCARE_DIRECTIVE',
  'BENEFICIARY_REVIEW',
  'OTHER'
);

CREATE TABLE "EstateDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "EstateDocumentType" NOT NULL,
  "title" VARCHAR(100),
  "reviewDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstateDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EstateDocument_userId_isActive_idx" ON "EstateDocument"("userId", "isActive");
CREATE INDEX "EstateDocument_userId_reviewDate_idx" ON "EstateDocument"("userId", "reviewDate");
ALTER TABLE "EstateDocument" ADD CONSTRAINT "EstateDocument_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
