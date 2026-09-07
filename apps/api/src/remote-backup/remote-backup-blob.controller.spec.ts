import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupBlobController } from './remote-backup-blob.controller';

describe('RemoteBackupBlobController', () => {
  it('rejects a non-binary request before authentication or storage', async () => {
    const peerAuth = { authenticateHeaders: vi.fn() };
    const storage = { receive: vi.fn() };
    const controller = new RemoteBackupBlobController(peerAuth as never, storage as never);

    await expect(
      controller.receive({ headers: { 'content-type': 'application/json' } } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(peerAuth.authenticateHeaders).not.toHaveBeenCalled();
    expect(storage.receive).not.toHaveBeenCalled();
  });

  it('authenticates a health check without touching opaque storage', async () => {
    const authenticateHeaders = vi.fn().mockResolvedValue({ peerId: 'peer-1' });
    const storage = { receive: vi.fn() };
    const controller = new RemoteBackupBlobController(
      { authenticateHeaders } as never,
      storage as never,
    );
    const request = {
      headers: {
        'x-wardkeep-peer': '11111111-1111-4111-8111-111111111111',
        'x-wardkeep-timestamp': '2026-09-06T00:00:00.000Z',
        'x-wardkeep-nonce': 'nonce-with-at-least-sixteen-bytes',
        'x-wardkeep-content-sha256': 'a'.repeat(64),
        'x-wardkeep-signature': 'v1=signature',
      },
    };

    await expect(controller.health(request as never)).resolves.toEqual({ status: 'ok' });
    expect(authenticateHeaders).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/remote-backup/health' }),
    );
    expect(storage.receive).not.toHaveBeenCalled();
  });
});
