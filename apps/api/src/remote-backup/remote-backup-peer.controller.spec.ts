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
});
