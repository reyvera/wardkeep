-- AlterTable: Add lastFailedAt to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastFailedAt" TIMESTAMP(3);

-- CreateEnum: TransactionStatus
DO $$ BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: BankConnectionProvider
DO $$ BEGIN
  CREATE TYPE "BankConnectionProvider" AS ENUM ('SIMPLEFIN', 'PLAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: BankConnectionStatus
DO $$ BEGIN
  CREATE TYPE "BankConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add TRANSFER to TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- AlterTable: Add status column to Transaction
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED';

-- CreateTable: PasswordResetToken
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: BankConnection
CREATE TABLE IF NOT EXISTS "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BankConnectionProvider" NOT NULL,
    "institutionName" VARCHAR(200) NOT NULL,
    "accessToken" VARCHAR(1000) NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankConnection_userId_status_idx" ON "BankConnection"("userId", "status");

ALTER TABLE "BankConnection" DROP CONSTRAINT IF EXISTS "BankConnection_userId_fkey";
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: LinkedBankAccount
CREATE TABLE IF NOT EXISTS "LinkedBankAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "accountId" TEXT,
    "externalId" VARCHAR(200) NOT NULL,
    "externalName" VARCHAR(200) NOT NULL,
    "externalType" VARCHAR(50) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LinkedBankAccount_connectionId_externalId_key" ON "LinkedBankAccount"("connectionId", "externalId");
CREATE INDEX IF NOT EXISTS "LinkedBankAccount_accountId_idx" ON "LinkedBankAccount"("accountId");

ALTER TABLE "LinkedBankAccount" DROP CONSTRAINT IF EXISTS "LinkedBankAccount_connectionId_fkey";
ALTER TABLE "LinkedBankAccount" ADD CONSTRAINT "LinkedBankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LinkedBankAccount" DROP CONSTRAINT IF EXISTS "LinkedBankAccount_accountId_fkey";
ALTER TABLE "LinkedBankAccount" ADD CONSTRAINT "LinkedBankAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
