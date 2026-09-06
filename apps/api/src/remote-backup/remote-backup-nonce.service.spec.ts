import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { hashRemoteBackupNonce, RemoteBackupNonceService } from './remote-backup-nonce.service';

describe('RemoteBackupNonceService', () => {
  it('expires old nonces and stores only a hash for a newly claimed nonce', async () => {
    const deleteMany = vi.fn();
    const create = vi.fn();
    const service = new RemoteBackupNonceService({
      remoteBackupRequestNonce: { deleteMany, create },
    } as never);
    const expiresAt = new Date('2026-09-05T00:05:00.000Z');
    const now = new Date('2026-09-05T00:00:00.000Z');

    await expect(service.claim('peer-1', 'unique-nonce', expiresAt, now)).resolves.toBe(true);

    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
    expect(create).toHaveBeenCalledWith({
      data: { peerId: 'peer-1', nonceHash: hashRemoteBackupNonce('unique-nonce'), expiresAt },
    });
  });

  it('rejects a duplicate peer-scoped nonce without exposing the database error', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('unique constraint', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const service = new RemoteBackupNonceService({
      remoteBackupRequestNonce: {
        deleteMany: vi.fn(),
        create: vi.fn().mockRejectedValue(duplicate),
      },
    } as never);

    await expect(
      service.claim('peer-1', 'replayed-nonce', new Date('2026-09-05T00:05:00.000Z')),
    ).resolves.toBe(false);
  });
});
