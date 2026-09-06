-- Retains the non-secret remote offer identifier only while a sender-side
-- pairing is pending. It makes a retry resume the same local peer identity.
ALTER TABLE "RemoteBackupPeer" ADD COLUMN "pairingOfferId" UUID;

CREATE INDEX "RemoteBackupPeer_userId_pairingOfferId_idx"
  ON "RemoteBackupPeer"("userId", "pairingOfferId");
