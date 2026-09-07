import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupRecoveryImportController } from './remote-backup-recovery-import.controller';

describe('RemoteBackupRecoveryImportController', () => {
  it('passes a complete portable-recovery request only to the authenticated household', async () => {
    const importPortableArchive = vi.fn().mockResolvedValue({ restored: true });
    const controller = new RemoteBackupRecoveryImportController({ importPortableArchive } as never);
    const body = {
      peerUrl: 'https://receiver.example',
      offerId: '11111111-1111-4111-8111-111111111111',
      secret: 's'.repeat(43),
      passphrase: 'p'.repeat(12),
    };
    await expect(controller.import({ userId: 'household-1' } as never, body)).resolves.toEqual({ restored: true });
    expect(importPortableArchive).toHaveBeenCalledWith({ userId: 'household-1', ...body });
  });

  it('rejects incomplete recovery credentials before contacting a peer', () => {
    const importPortableArchive = vi.fn();
    const controller = new RemoteBackupRecoveryImportController({ importPortableArchive } as never);
    expect(() => controller.import({ userId: 'household-1' } as never, {})).toThrow(BadRequestException);
    expect(importPortableArchive).not.toHaveBeenCalled();
  });
});
