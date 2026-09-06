import { describe, expect, it, vi } from 'vitest';

import { redeemRemoteBackupOffer } from './remote-backup-pairing-client';

describe('remote backup pairing client', () => {
  const payload = {
    offerId: '11111111-1111-4111-8111-111111111111',
    secret: 'a'.repeat(43),
    remotePeerId: '22222222-2222-4222-8222-222222222222',
    peerUrl: 'https://sender.example',
    peerName: 'Sender',
    direction: 'BOTH',
  };

  it('connects to the address that passed DNS safety validation', async () => {
    const transport = vi.fn().mockResolvedValue({
      statusCode: 201,
      body: Buffer.from(JSON.stringify({ peerId: 'peer-1' })),
    });

    await expect(
      redeemRemoteBackupOffer('https://receiver.example', payload, {
        resolveAddresses: async () => ['203.0.113.9'],
        transport,
      }),
    ).resolves.toEqual({ peerId: 'peer-1' });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '203.0.113.9',
        hostname: 'receiver.example',
        path: '/api/remote-backup/pair/redeem',
      }),
    );
  });

  it('rejects non-success responses without exposing a peer response body', async () => {
    await expect(
      redeemRemoteBackupOffer('https://receiver.example', payload, {
        resolveAddresses: async () => ['203.0.113.9'],
        transport: async () => ({ statusCode: 409, body: Buffer.from('sensitive response') }),
      }),
    ).rejects.toThrow('rejected');
  });
});
