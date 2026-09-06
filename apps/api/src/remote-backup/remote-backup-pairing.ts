import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const REMOTE_BACKUP_PAIRING_OFFER_TTL_MS = 15 * 60 * 1000;

export interface RemoteBackupPairingOfferState {
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
}

export function createRemoteBackupPairingSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRemoteBackupPairingSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function verifyRemoteBackupPairingSecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashRemoteBackupPairingSecret(secret), 'utf-8');
  const expected = Buffer.from(expectedHash, 'utf-8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function remoteBackupPairingOfferExpiry(
  now = new Date(),
  ttlMs = REMOTE_BACKUP_PAIRING_OFFER_TTL_MS,
): Date {
  return new Date(now.getTime() + ttlMs);
}

export function isRemoteBackupPairingOfferRedeemable(
  offer: RemoteBackupPairingOfferState,
  now = new Date(),
): boolean {
  return !offer.redeemedAt && !offer.revokedAt && offer.expiresAt.getTime() > now.getTime();
}
