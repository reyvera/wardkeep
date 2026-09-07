import { BadRequestException } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { readFile as readStream } from 'node:fs/promises';
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
    delete process.env['WARDKEEP_REMOTE_BACKUP_STORAGE_BYTES'];
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
        aggregate: vi.fn().mockResolvedValue({ _sum: { size: 0n } }),
        findFirst: vi.fn().mockResolvedValue(null),
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
      remoteBackup: {
        create,
        aggregate: vi.fn().mockResolvedValue({ _sum: { size: 0n } }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
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

  it('rejects a new archive before writing when the peer quota is exhausted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-remote-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_REMOTE_BACKUP_DIR'] = directory;
    process.env['WARDKEEP_REMOTE_BACKUP_STORAGE_BYTES'] = '10';
    const create = vi.fn();
    const aggregate = vi.fn().mockResolvedValue({ _sum: { size: 8n } });
    const service = new RemoteBackupStorageService({
      remoteBackup: {
        create,
        aggregate,
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        delete: vi.fn(),
      },
    } as never);
    const data = 'four';

    await expect(
      service.receive({
        peerId: 'peer-1',
        userId: 'household-1',
        sourceBackupId: 'source-backup-1',
        recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
        createdAt: new Date(),
        expectedSize: Buffer.byteLength(data),
        expectedChecksum: createHash('sha256').update(data).digest('hex'),
        chunks: chunks(data),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not expose another peer's metadata or archive stream", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new RemoteBackupStorageService({
      remoteBackup: { findMany, findFirst } as never,
    } as never);

    await expect(service.list('peer-a')).resolves.toEqual([]);
    await expect(service.open('peer-a', 'backup-owned-by-peer-b')).resolves.toBeNull();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { peerId: 'peer-a' } }));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'backup-owned-by-peer-b', peerId: 'peer-a' } }),
    );
  });

  it('rejects a duplicate source backup ID when its digest differs', async () => {
    const create = vi.fn();
    const service = new RemoteBackupStorageService({
      remoteBackup: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing',
          size: 4n,
          checksum: 'a'.repeat(64),
          createdAt: new Date(),
          receivedAt: new Date(),
        }),
        create,
      },
    } as never);
    await expect(
      service.receive({
        peerId: 'peer-1',
        userId: 'household-1',
        sourceBackupId: 'source-backup-1',
        recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
        createdAt: new Date(),
        expectedSize: 4,
        expectedChecksum: 'b'.repeat(64),
        chunks: chunks('four'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('treats an identical source backup replay as idempotent', async () => {
    const checksum = 'a'.repeat(64);
    const existing = {
      id: 'existing',
      size: 4n,
      checksum,
      createdAt: new Date('2026-09-01'),
      receivedAt: new Date('2026-09-01'),
    };
    const service = new RemoteBackupStorageService({
      remoteBackup: {
        findFirst: vi.fn().mockResolvedValue(existing),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
    } as never);

    await expect(
      service.receive({
        peerId: 'peer-1',
        userId: 'household-1',
        sourceBackupId: 'source-backup-1',
        recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
        createdAt: new Date(),
        expectedSize: 4,
        expectedChecksum: checksum,
        chunks: chunks('four'),
      }),
    ).resolves.toEqual({ ...existing, size: 4 });
  });

  it('round-trips an opaque archive through one peer-scoped receiver', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-remote-backup-'));
    directories.push(directory);
    process.env['WARDKEEP_REMOTE_BACKUP_DIR'] = directory;
    const records: Array<Record<string, unknown>> = [];
    const remoteBackup = {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, string> }) =>
          records.find((record) =>
            Object.entries(where).every(([key, value]) => record[key] === value),
          ) ?? null,
      ),
      aggregate: vi.fn().mockResolvedValue({ _sum: { size: 0n } }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...data };
        records.push(record);
        return record;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, string> }) =>
        records.filter((record) => record.peerId === where.peerId),
      ),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    };
    const receiver = new RemoteBackupStorageService({ remoteBackup } as never);
    const data = 'already-encrypted-opaque-archive';
    const checksum = createHash('sha256').update(data).digest('hex');
    const stored = await receiver.receive({
      peerId: 'peer-a',
      userId: 'household-a',
      sourceBackupId: 'source-a',
      recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
      createdAt: new Date(),
      expectedSize: Buffer.byteLength(data),
      expectedChecksum: checksum,
      chunks: chunks(data),
    });
    const listed = await receiver.list('peer-a');
    const opened = await receiver.open('peer-a', stored.id);

    expect(listed).toHaveLength(1);
    expect(opened).not.toBeNull();
    await expect(readStream(join(directory, 'peer-a', `${stored.id}.enc`), 'utf-8')).resolves.toBe(
      data,
    );
    expect(opened?.checksum).toBe(checksum);
  });
});
