import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { BackupController } from './backup.controller';

const householdId = '11111111-1111-4111-8111-111111111111';
const backupId = '22222222-2222-4222-8222-222222222222';
const request = { userId: householdId };

describe('BackupController recovery boundaries', () => {
  it('uses the authenticated household for a manual restore request', async () => {
    const restoreBackup = vi.fn().mockResolvedValue({ message: 'Backup restored successfully' });
    const controller = new BackupController({ restoreBackup } as never);

    await expect(controller.restoreBackup({
      ...request,
      body: { backupId, passphrase: 'twelve-character-passphrase' },
    } as never)).resolves.toEqual({ message: 'Backup restored successfully' });

    expect(restoreBackup).toHaveBeenCalledWith(
      householdId,
      backupId,
      'twelve-character-passphrase',
    );
  });

  it('permits an automatic restore without exposing a passphrase requirement', async () => {
    const restoreBackup = vi.fn().mockResolvedValue({ message: 'Backup restored successfully' });
    const controller = new BackupController({ restoreBackup } as never);

    await controller.restoreBackup({ ...request, body: { backupId } } as never);

    expect(restoreBackup).toHaveBeenCalledWith(householdId, backupId, undefined);
  });

  it('rejects malformed restore requests before they reach recovery logic', async () => {
    const restoreBackup = vi.fn();
    const controller = new BackupController({ restoreBackup } as never);

    await expect(controller.restoreBackup({
      ...request,
      body: { backupId: 'not-a-uuid' },
    } as never)).rejects.toBeInstanceOf(BadRequestException);

    expect(restoreBackup).not.toHaveBeenCalled();
  });

  it('lists backups only for the authenticated household', async () => {
    const listBackups = vi.fn().mockResolvedValue([]);
    const controller = new BackupController({ listBackups } as never);

    await expect(controller.listBackups(request as never)).resolves.toEqual([]);

    expect(listBackups).toHaveBeenCalledWith(householdId);
  });
});
