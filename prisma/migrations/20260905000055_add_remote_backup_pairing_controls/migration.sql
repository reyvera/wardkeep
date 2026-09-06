-- Single-use pairing offers keep only a secret hash. Accepted HMAC nonces are
-- peer-scoped and short-lived so authenticated requests cannot be replayed.
CREATE TABLE "RemoteBackupPairingOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" VARCHAR(64) NOT NULL,
    "direction" "RemoteBackupPeerDirection" NOT NULL DEFAULT 'BOTH',
    "peerName" VARCHAR(120),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteBackupPairingOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemoteBackupRequestNonce" (
    "id" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "nonceHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteBackupRequestNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemoteBackupPairingOffer_secretHash_key" ON "RemoteBackupPairingOffer"("secretHash");
CREATE INDEX "RemoteBackupPairingOffer_userId_expiresAt_idx" ON "RemoteBackupPairingOffer"("userId", "expiresAt");
CREATE UNIQUE INDEX "RemoteBackupRequestNonce_peerId_nonceHash_key" ON "RemoteBackupRequestNonce"("peerId", "nonceHash");
CREATE INDEX "RemoteBackupRequestNonce_expiresAt_idx" ON "RemoteBackupRequestNonce"("expiresAt");

ALTER TABLE "RemoteBackupPairingOffer" ADD CONSTRAINT "RemoteBackupPairingOffer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemoteBackupRequestNonce" ADD CONSTRAINT "RemoteBackupRequestNonce_peerId_fkey"
  FOREIGN KEY ("peerId") REFERENCES "RemoteBackupPeer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
