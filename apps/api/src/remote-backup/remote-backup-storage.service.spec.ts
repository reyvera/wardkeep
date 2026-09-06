import { BadRequestException } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RemoteBackupStorageService } from './remote-backup-storage.service';

async function* chunks(...values: string[]) {
  for (const value of values) yield Buffer.from(value);
}

describe('RemoteBackupStorageService', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
    delete process.env['WARDKEEP_REMOTE_BACKUP_DIR'];
  });

  it('writes only a verified opaque blob and records its matching metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-remote-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_REMOTE_BACKUP_DIR'] = directory;
    const data = 'opaque encrypted backup';
    const checksum = createHash('sha256').update(data).digest('hex');
    const create = vi.fn().mockImplementation(async ({ data: record }) => record);
    const service = new RemoteBackupStorageService({
      remoteBackup: {
        create,
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
    } as never);

    const result = await service.receive({
      peerId: 'peer-1',
      userId: 'household-1',
      sourceBackupId: 'source-backup-1',
      recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      expectedSize: Buffer.byteLength(data),
      expectedChecksum: checksum,
      chunks: chunks('opaque ', 'encrypted backup'),
    });

    expect(result.checksum).toBe(checksum);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ peerId: 'peer-1', userId: 'household-1', checksum }),
    });
    await expect(readFile(join(directory, 'peer-1', `${result.id}.enc`), 'utf-8')).resolves.toBe(
      data,
    );
  });

  it('does not persist mismatched or truncated content', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-remote-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_REMOTE_BACKUP_DIR'] = directory;
    const create = vi.fn();
    const service = new RemoteBackupStorageService({
      remoteBackup: { create, findMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    } as never);

    await expect(
      service.receive({
        peerId: 'peer-1',
        userId: 'household-1',
        sourceBackupId: 'source-backup-1',
        recoveryClass: RemoteBackupRecoveryClass.SOURCE_TIED_AUTOMATED,
        createdAt: new Date(),
        expectedSize: 4,
        expectedChecksum: '0'.repeat(64),
        chunks: chunks('nope'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    await expect(readdir(join(directory, 'peer-1'))).resolves.toEqual([]);
  });
});
