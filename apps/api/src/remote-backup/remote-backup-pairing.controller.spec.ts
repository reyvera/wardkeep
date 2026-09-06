import { BadRequestException } from '@nestjs/common';
import { RemoteBackupPeerDirection } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupPairingController } from './remote-backup-pairing.controller';

describe('RemoteBackupPairingController', () => {
  const request = { userId: 'household-1' };

  it('creates an offer only for the authenticated household', async () => {
    const createOffer = vi.fn().mockResolvedValue({ offerId: 'offer-1' });
    const controller = new RemoteBackupPairingController({ createOffer } as never);

    await expect(
      controller.createOffer(request as never, { peerName: 'Recovery peer' }),
    ).resolves.toEqual({ offerId: 'offer-1' });
    expect(createOffer).toHaveBeenCalledWith('household-1', {
      direction: RemoteBackupPeerDirection.BOTH,
      peerName: 'Recovery peer',
    });
  });

  it('rejects malformed offer IDs before the revocation service runs', () => {
    const revokeOffer = vi.fn();
    const controller = new RemoteBackupPairingController({ revokeOffer } as never);

    expect(() => controller.revokeOffer(request as never, 'not-a-uuid')).toThrow(
      BadRequestException,
    );
    expect(revokeOffer).not.toHaveBeenCalled();
  });

  it('rejects an unsafe peer URL before the offer can be redeemed', async () => {
    const redeemOffer = vi.fn();
    const controller = new RemoteBackupPairingController({ redeemOffer } as never);

    await expect(
      controller.redeemOffer({
        offerId: '11111111-1111-4111-8111-111111111111',
        secret: 'a'.repeat(43),
        remotePeerId: '22222222-2222-4222-8222-222222222222',
        peerUrl: 'https://localhost',
        peerName: 'Unsafe peer',
        direction: RemoteBackupPeerDirection.BOTH,
      }),
    ).rejects.toThrow('unsafe');
    expect(redeemOffer).not.toHaveBeenCalled();
  });
});
