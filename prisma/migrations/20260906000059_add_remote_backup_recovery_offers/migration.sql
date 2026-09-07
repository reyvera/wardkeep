CREATE TABLE "RemoteBackupRecoveryOffer" (
  "id" TEXT NOT NULL,
  "remoteBackupId" TEXT NOT NULL,
  "secretHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemoteBackupRecoveryOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemoteBackupRecoveryOffer_secretHash_key" ON "RemoteBackupRecoveryOffer"("secretHash");
CREATE INDEX "RemoteBackupRecoveryOffer_remoteBackupId_expiresAt_idx" ON "RemoteBackupRecoveryOffer"("remoteBackupId", "expiresAt");
ALTER TABLE "RemoteBackupRecoveryOffer" ADD CONSTRAINT "RemoteBackupRecoveryOffer_remoteBackupId_fkey" FOREIGN KEY ("remoteBackupId") REFERENCES "RemoteBackup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
