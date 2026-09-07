import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupPeerController } from './remote-backup-peer.controller';

describe('RemoteBackupPeerController', () => {
  it('uses the authenticated household scope for peer listing', async () => {
    const list = vi.fn().mockResolvedValue([]);
    const controller = new RemoteBackupPeerController({ list } as never);

    await expect(controller.list({ userId: 'household-1' } as never)).resolves.toEqual([]);
    expect(list).toHaveBeenCalledWith('household-1');
  });

  it('rejects malformed peer IDs before revocation', () => {
    const revoke = vi.fn();
    const controller = new RemoteBackupPeerController({ revoke } as never);

    expect(() => controller.revoke({ userId: 'household-1' } as never, 'not-a-uuid')).toThrow(
      BadRequestException,
    );
    expect(revoke).not.toHaveBeenCalled();
  });

  it('lists remote copies only through the authenticated household', async () => {
    const listRemoteBackups = vi.fn().mockResolvedValue([]);
    const controller = new RemoteBackupPeerController({} as never, { listRemoteBackups } as never);
    const peerId = '11111111-1111-4111-8111-111111111111';

    await expect(
      controller.listBackups({ userId: 'household-1' } as never, peerId),
    ).resolves.toEqual([]);
    expect(listRemoteBackups).toHaveBeenCalledWith('household-1', peerId);
  });

  it('rejects malformed remote restore identifiers before downloading an archive', () => {
    const restoreRemoteBackup = vi.fn();
    const controller = new RemoteBackupPeerController(
      {} as never,
      { restoreRemoteBackup } as never,
    );

    expect(() =>
      controller.restoreBackup(
        { userId: 'household-1', body: {} } as never,
        'not-a-uuid',
        'also-not-a-uuid',
      ),
    ).toThrow(BadRequestException);
    expect(restoreRemoteBackup).not.toHaveBeenCalled();
  });
});
