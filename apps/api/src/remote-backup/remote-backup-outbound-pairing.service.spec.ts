import { RemoteBackupPeerDirection, RemoteBackupPeerStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./remote-backup-public-url', () => ({
  getRemoteBackupPublicUrl: vi.fn(),
}));
vi.mock('./remote-backup-peer-url', () => ({
  resolveRemoteBackupPeerAddresses: vi.fn(),
  resolveRemoteBackupPeerUrl: vi.fn(),
}));
vi.mock('./remote-backup-pairing-client', () => ({
  redeemRemoteBackupOffer: vi.fn(),
}));

import { AuditService } from '../common/services/audit.service';
import { EncryptionService } from '../common/services/encryption.service';
import { getRemoteBackupPublicUrl } from './remote-backup-public-url';
import { redeemRemoteBackupOffer } from './remote-backup-pairing-client';
import { RemoteBackupOutboundPairingService } from './remote-backup-outbound-pairing.service';
import { resolveRemoteBackupPeerUrl } from './remote-backup-peer-url';

const input = {
  offerId: '11111111-1111-4111-8111-111111111111',
  secret: 'a'.repeat(43),
  peerUrl: 'https://receiver.example',
  peerName: 'Off-site Wardkeep',
  localPeerName: 'Home Wardkeep',
  direction: RemoteBackupPeerDirection.BOTH,
};

describe('RemoteBackupOutboundPairingService', () => {
  it('durably creates and completes a sender peer using the receiver response', async () => {
    vi.mocked(getRemoteBackupPublicUrl).mockResolvedValue('https://sender.example');
    vi.mocked(resolveRemoteBackupPeerUrl).mockResolvedValue({
      url: new URL('https://receiver.example'),
      address: '203.0.113.9',
    });
    vi.mocked(redeemRemoteBackupOffer).mockResolvedValue({
      peerId: '22222222-2222-4222-8222-222222222222',
      remotePeerId: '33333333-3333-4333-8333-333333333333',
      status: RemoteBackupPeerStatus.PAIRED,
    });
    const createdPeer = {
      id: '33333333-3333-4333-8333-333333333333',
      remotePeerId: null,
      status: RemoteBackupPeerStatus.PENDING,
    };
    const create = vi.fn().mockResolvedValue(createdPeer);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const audit = { log: vi.fn() };
    const pairing = new RemoteBackupOutboundPairingService(
      {
        remoteBackupPeer: { findUnique: vi.fn().mockResolvedValue(null), create, updateMany },
      } as never,
      new EncryptionService(),
      audit as unknown as AuditService,
    );

    await expect(pairing.connect('household-1', input)).resolves.toEqual({
      peerId: createdPeer.id,
      remotePeerId: '22222222-2222-4222-8222-222222222222',
      status: RemoteBackupPeerStatus.PAIRED,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pairingOfferId: input.offerId,
          status: RemoteBackupPeerStatus.PENDING,
        }),
      }),
    );
    expect(redeemRemoteBackupOffer).toHaveBeenCalledWith(
      'https://receiver.example',
      expect.objectContaining({ remotePeerId: createdPeer.id, peerUrl: 'https://sender.example' }),
    );
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          remotePeerId: '22222222-2222-4222-8222-222222222222',
          status: RemoteBackupPeerStatus.PAIRED,
        }),
      }),
    );
  });
});
