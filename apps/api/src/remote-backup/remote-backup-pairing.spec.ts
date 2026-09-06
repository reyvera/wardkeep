import { describe, expect, it } from 'vitest';

import {
  createRemoteBackupPairingSecret,
  hashRemoteBackupPairingSecret,
  isRemoteBackupPairingOfferRedeemable,
  remoteBackupPairingOfferExpiry,
  verifyRemoteBackupPairingSecret,
} from './remote-backup-pairing';

describe('remote backup pairing secrets', () => {
  it('creates a high-entropy secret that only verifies against its hash', () => {
    const secret = createRemoteBackupPairingSecret();
    const hash = hashRemoteBackupPairingSecret(secret);

    expect(secret).toHaveLength(43);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyRemoteBackupPairingSecret(secret, hash)).toBe(true);
    expect(verifyRemoteBackupPairingSecret(`${secret}x`, hash)).toBe(false);
  });

  it('sets a fifteen-minute offer expiry by default', () => {
    const now = new Date('2026-09-05T00:00:00.000Z');

    expect(remoteBackupPairingOfferExpiry(now)).toEqual(new Date('2026-09-05T00:15:00.000Z'));
  });

  it('allows only unexpired, unredeemed, and unrecalled offers', () => {
    const now = new Date('2026-09-05T00:00:00.000Z');
    const baseOffer = {
      expiresAt: new Date('2026-09-05T00:15:00.000Z'),
      redeemedAt: null,
      revokedAt: null,
    };

    expect(isRemoteBackupPairingOfferRedeemable(baseOffer, now)).toBe(true);
    expect(
      isRemoteBackupPairingOfferRedeemable(
        { ...baseOffer, redeemedAt: new Date('2026-09-05T00:01:00.000Z') },
        now,
      ),
    ).toBe(false);
    expect(
      isRemoteBackupPairingOfferRedeemable(
        { ...baseOffer, revokedAt: new Date('2026-09-05T00:01:00.000Z') },
        now,
      ),
    ).toBe(false);
    expect(isRemoteBackupPairingOfferRedeemable({ ...baseOffer, expiresAt: now }, now)).toBe(false);
  });
});
