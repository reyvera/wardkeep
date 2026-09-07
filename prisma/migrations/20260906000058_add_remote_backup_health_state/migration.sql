ALTER TYPE "RemoteBackupPeerStatus" ADD VALUE 'UNREACHABLE';

ALTER TABLE "RemoteBackupPeer"
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
