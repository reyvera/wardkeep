CREATE TABLE "RemoteBackupRecoverySession" (
  "id" TEXT NOT NULL,
  "remoteBackupId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemoteBackupRecoverySession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RemoteBackupRecoverySession_tokenHash_key" ON "RemoteBackupRecoverySession"("tokenHash");
CREATE INDEX "RemoteBackupRecoverySession_remoteBackupId_expiresAt_idx" ON "RemoteBackupRecoverySession"("remoteBackupId", "expiresAt");
ALTER TABLE "RemoteBackupRecoverySession" ADD CONSTRAINT "RemoteBackupRecoverySession_remoteBackupId_fkey" FOREIGN KEY ("remoteBackupId") REFERENCES "RemoteBackup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
