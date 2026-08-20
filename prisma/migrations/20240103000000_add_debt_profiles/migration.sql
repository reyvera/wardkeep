-- CreateTable
CREATE TABLE "DebtProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "apr" DECIMAL(5,4) NOT NULL,
    "minimumPayment" DECIMAL(19,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPayoffPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountIds" TEXT[],
    "strategy" TEXT NOT NULL,
    "totalMonthlyPayment" DECIMAL(19,4) NOT NULL,
    "totalInterest" DECIMAL(19,4) NOT NULL,
    "totalMonths" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPayoffPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebtProfile_accountId_key" ON "DebtProfile"("accountId");

-- CreateIndex
CREATE INDEX "DebtProfile_userId_idx" ON "DebtProfile"("userId");

-- CreateIndex
CREATE INDEX "SavedPayoffPlan_userId_idx" ON "SavedPayoffPlan"("userId");

-- AddForeignKey
ALTER TABLE "DebtProfile" ADD CONSTRAINT "DebtProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
