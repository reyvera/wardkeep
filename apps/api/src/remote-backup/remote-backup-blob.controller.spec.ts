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
});
