import { createHmac } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackupInternalController } from './backup-internal.controller';

const WORKER_TOKEN_PURPOSE = 'wardkeep:scheduled-backup-worker:v1';

describe('BackupInternalController', () => {
  const originalKey = process.env['ENCRYPTION_KEY'];

  afterEach(() => {
    if (originalKey === undefined) delete process.env['ENCRYPTION_KEY'];
    else process.env['ENCRYPTION_KEY'] = originalKey;
  });

  it('runs due schedules only for a worker with the deployment-derived credential', async () => {
    const encryptionKey = 'test-deployment-key';
    process.env['ENCRYPTION_KEY'] = encryptionKey;
    const runDueScheduledBackups = vi.fn().mockResolvedValue({ created: 2 });
    const controller = new BackupInternalController({ runDueScheduledBackups } as never);
    const token = createHmac('sha256', encryptionKey).update(WORKER_TOKEN_PURPOSE).digest('hex');

    await expect(controller.runDueScheduledBackups(token)).resolves.toEqual({ created: 2 });
    expect(runDueScheduledBackups).toHaveBeenCalledOnce();
  });

  it('rejects an invalid worker credential before running backups', async () => {
    process.env['ENCRYPTION_KEY'] = 'test-deployment-key';
    const runDueScheduledBackups = vi.fn();
    const controller = new BackupInternalController({ runDueScheduledBackups } as never);

    await expect(controller.runDueScheduledBackups('not-valid')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(runDueScheduledBackups).not.toHaveBeenCalled();
  });
});
