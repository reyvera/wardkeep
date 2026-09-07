import { createHmac } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RemoteBackupInternalController } from './remote-backup-internal.controller';

const WORKER_TOKEN_PURPOSE = 'wardkeep:scheduled-remote-backup-worker:v1';

describe('RemoteBackupInternalController', () => {
  const originalKey = process.env['ENCRYPTION_KEY'];

  afterEach(() => {
    if (originalKey === undefined) delete process.env['ENCRYPTION_KEY'];
    else process.env['ENCRYPTION_KEY'] = originalKey;
  });

  it('runs due remote schedules only for a worker with the deployment-derived credential', async () => {
    const encryptionKey = 'test-deployment-key';
    process.env['ENCRYPTION_KEY'] = encryptionKey;
    const runDueScheduledSyncs = vi.fn().mockResolvedValue({ synced: 2, failed: 0 });
    const controller = new RemoteBackupInternalController({ runDueScheduledSyncs } as never);
    const token = createHmac('sha256', encryptionKey).update(WORKER_TOKEN_PURPOSE).digest('hex');

    await expect(controller.runDue(token)).resolves.toEqual({ synced: 2, failed: 0 });
    expect(runDueScheduledSyncs).toHaveBeenCalledOnce();
  });

  it('rejects an invalid worker credential before scheduling remote copies', async () => {
    process.env['ENCRYPTION_KEY'] = 'test-deployment-key';
    const runDueScheduledSyncs = vi.fn();
    const controller = new RemoteBackupInternalController({ runDueScheduledSyncs } as never);

    await expect(controller.runDue('not-valid')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(runDueScheduledSyncs).not.toHaveBeenCalled();
  });
});
