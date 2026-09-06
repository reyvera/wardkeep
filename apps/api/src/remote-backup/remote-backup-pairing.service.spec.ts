import { BadRequestException, ConflictException } from '@nestjs/common';
import { RemoteBackupPeerDirection } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { EncryptionService } from '../common/services/encryption.service';
import { hashRemoteBackupPairingSecret } from './remote-backup-pairing';
import { RemoteBackupPairingService } from './remote-backup-pairing.service';

function service(prisma: unknown, audit = { log: vi.fn() }) {
  return new RemoteBackupPairingService(prisma as never, new EncryptionService(), audit as never);
}

describe('RemoteBackupPairingService', () => {
  it('creates an offer while retaining only a secret hash', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      id: 'offer-1',
      direction: data.direction,
      expiresAt: data.expiresAt,
    }));
    const now = new Date('2026-09-05T00:00:00.000Z');
    const audit = { log: vi.fn() };
    const result = await service({ remoteBackupPairingOffer: { create } }, audit).createOffer(
      'household-1',
      { direction: RemoteBackupPeerDirection.BOTH, peerName: 'Off-site Wardkeep' },
      now,
    );

    expect(result.secret).toHaveLength(43);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'household-1',
        secretHash: hashRemoteBackupPairingSecret(result.secret),
        peerName: 'Off-site Wardkeep',
      }),
    });
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.offer_created', {
      offerId: 'offer-1',
      direction: RemoteBackupPeerDirection.BOTH,
    });
  });

  it('atomically redeems a valid offer and encrypts the peer secret', async () => {
    const secret = 'a-valid-pairing-secret';
    const offer = {
      id: 'offer-1',
      userId: 'household-1',
      secretHash: hashRemoteBackupPairingSecret(secret),
      direction: RemoteBackupPeerDirection.BOTH,
      expiresAt: new Date('2026-09-05T00:15:00.000Z'),
      redeemedAt: null,
      revokedAt: null,
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi
      .fn()
      .mockResolvedValue({ id: 'peer-1', remotePeerId: null, status: 'PAIRED' });
    const tx = {
      remoteBackupPairingOffer: { findUnique: vi.fn().mockResolvedValue(offer), updateMany },
      remoteBackupPeer: { create },
    };
    const audit = { log: vi.fn() };
    const result = await service(
      { $transaction: (callback: (value: typeof tx) => unknown) => callback(tx) },
      audit,
    ).redeemOffer(
      {
        offerId: offer.id,
        secret,
        remotePeerId: 'sender-peer-1',
        peerUrl: 'https://sender.example',
        peerName: 'Sender Wardkeep',
        direction: RemoteBackupPeerDirection.BOTH,
      },
      new Date('2026-09-05T00:01:00.000Z'),
    );

    expect(result).toEqual({ peerId: 'peer-1', remotePeerId: null, status: 'PAIRED' });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { redeemedAt: expect.any(Date) } }),
    );
    const encryptedSecret = create.mock.calls[0][0].data.sharedSecret;
    expect(encryptedSecret).not.toBe(secret);
    expect(new EncryptionService().decrypt(encryptedSecret)).toBe(secret);
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.offer_redeemed', {
      offerId: offer.id,
      remotePeerId: 'sender-peer-1',
      direction: RemoteBackupPeerDirection.BOTH,
    });
  });

  it('does not redeem an expired, revoked, or mismatched offer', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'offer-1',
      userId: 'household-1',
      secretHash: hashRemoteBackupPairingSecret('correct-secret'),
      direction: RemoteBackupPeerDirection.PUSH,
      expiresAt: new Date('2026-09-05T00:00:00.000Z'),
      redeemedAt: null,
      revokedAt: null,
    });
    const tx = {
      remoteBackupPairingOffer: { findUnique, updateMany: vi.fn() },
      remoteBackupPeer: { create: vi.fn() },
    };
    const pairing = service({
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    });

    await expect(
      pairing.redeemOffer({
        offerId: 'offer-1',
        secret: 'wrong-secret',
        remotePeerId: 'sender-peer-1',
        peerUrl: 'https://sender.example',
        peerName: 'Sender Wardkeep',
        direction: RemoteBackupPeerDirection.PUSH,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.remoteBackupPairingOffer.updateMany).not.toHaveBeenCalled();
    expect(tx.remoteBackupPeer.create).not.toHaveBeenCalled();
  });

  it('returns the original peer for an identical retry after a response is lost', async () => {
    const secret = 'a-valid-pairing-secret';
    const existingPeer = {
      id: 'peer-1',
      remotePeerId: 'sender-peer-1',
      peerUrl: 'https://sender.example',
      peerName: 'Sender Wardkeep',
      direction: RemoteBackupPeerDirection.BOTH,
      status: 'PAIRED',
      sharedSecret: new EncryptionService().encrypt(secret),
    };
    const findFirst = vi.fn().mockResolvedValue(existingPeer);
    const pairing = service({
      $transaction: (callback: (value: unknown) => unknown) =>
        callback({
          remoteBackupPairingOffer: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'offer-1',
              userId: 'household-1',
              secretHash: hashRemoteBackupPairingSecret(secret),
              direction: RemoteBackupPeerDirection.BOTH,
              redeemedAt: new Date('2026-09-05T00:01:00.000Z'),
            }),
          },
          remoteBackupPeer: { findFirst },
        }),
    });

    await expect(
      pairing.redeemOffer({
        offerId: 'offer-1',
        secret,
        remotePeerId: 'sender-peer-1',
        peerUrl: 'https://sender.example',
        peerName: 'Sender Wardkeep',
        direction: RemoteBackupPeerDirection.BOTH,
      }),
    ).resolves.toEqual({ peerId: 'peer-1', remotePeerId: 'sender-peer-1', status: 'PAIRED' });
    expect(findFirst).toHaveBeenCalledOnce();
  });

  it('rejects a retried offer when its peer details do not match', async () => {
    const secret = 'a-valid-pairing-secret';
    const pairing = service({
      $transaction: (callback: (value: unknown) => unknown) =>
        callback({
          remoteBackupPairingOffer: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'offer-1',
              userId: 'household-1',
              secretHash: hashRemoteBackupPairingSecret(secret),
              direction: RemoteBackupPeerDirection.BOTH,
              redeemedAt: new Date('2026-09-05T00:01:00.000Z'),
            }),
          },
          remoteBackupPeer: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'peer-1',
              remotePeerId: 'sender-peer-1',
              peerUrl: 'https://different.example',
              peerName: 'Sender Wardkeep',
              direction: RemoteBackupPeerDirection.BOTH,
              status: 'PAIRED',
              sharedSecret: new EncryptionService().encrypt(secret),
            }),
          },
        }),
    });

    await expect(
      pairing.redeemOffer({
        offerId: 'offer-1',
        secret,
        remotePeerId: 'sender-peer-1',
        peerUrl: 'https://sender.example',
        peerName: 'Sender Wardkeep',
        direction: RemoteBackupPeerDirection.BOTH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
