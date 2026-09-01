CREATE TABLE "RealEstateProfile" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "mortgageAccountId" TEXT,
  "recordedValue" DECIMAL(19,4) NOT NULL,
  "valuationDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealEstateProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RealEstateProfile_accountId_key" UNIQUE ("accountId"),
  CONSTRAINT "RealEstateProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
