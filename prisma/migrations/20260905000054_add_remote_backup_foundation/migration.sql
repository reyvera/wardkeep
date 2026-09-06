-- Remote backup peers store only encrypted pairing metadata. RemoteBackup rows
-- describe opaque encrypted blobs; neither table contains household plaintext.
CREATE TYPE "RemoteBackupPeerDirection" AS ENUM ('PUSH', 'PULL', 'BOTH');
CREATE TYPE "RemoteBackupPeerStatus" AS ENUM ('PENDING', 'PAIRED', 'REVOKED');
CREATE TYPE "RemoteBackupRecoveryClass" AS ENUM ('SOURCE_TIED_AUTOMATED', 'PORTABLE_MANUAL');

CREATE TABLE "RemoteBackupPeer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remotePeerId" VARCHAR(100),
    "peerUrl" VARCHAR(2048) NOT NULL,
    "peerName" VARCHAR(120) NOT NULL,
    "sharedSecret" TEXT,
    "direction" "RemoteBackupPeerDirection" NOT NULL DEFAULT 'BOTH',
    "status" "RemoteBackupPeerStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteBackupPeer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemoteBackup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "sourceBackupId" VARCHAR(100) NOT NULL,
    "recoveryClass" "RemoteBackupRecoveryClass" NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemoteBackupPeer_remotePeerId_key" ON "RemoteBackupPeer"("remotePeerId");
CREATE UNIQUE INDEX "RemoteBackupPeer_userId_peerUrl_key" ON "RemoteBackupPeer"("userId", "peerUrl");
CREATE INDEX "RemoteBackupPeer_userId_status_idx" ON "RemoteBackupPeer"("userId", "status");
CREATE UNIQUE INDEX "RemoteBackup_peerId_sourceBackupId_key" ON "RemoteBackup"("peerId", "sourceBackupId");
CREATE INDEX "RemoteBackup_userId_createdAt_idx" ON "RemoteBackup"("userId", "createdAt");
CREATE INDEX "RemoteBackup_peerId_createdAt_idx" ON "RemoteBackup"("peerId", "createdAt");

ALTER TABLE "RemoteBackupPeer" ADD CONSTRAINT "RemoteBackupPeer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemoteBackup" ADD CONSTRAINT "RemoteBackup_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemoteBackup" ADD CONSTRAINT "RemoteBackup_peerId_fkey"
  FOREIGN KEY ("peerId") REFERENCES "RemoteBackupPeer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
