import { NotFoundException } from '@nestjs/common';
import { RemoteBackupPeerStatus, RemoteBackupSyncSchedule } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupPeerService } from './remote-backup-peer.service';

describe('RemoteBackupPeerService', () => {
  it('lists only non-secret metadata scoped to the requesting household', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new RemoteBackupPeerService(
      { remoteBackupPeer: { findMany } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.list('household-1')).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'household-1' },
        select: expect.not.objectContaining({ sharedSecret: expect.anything() }),
      }),
    );
  });

  it('revokes only the requesting household peer and records an audit event', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const audit = { log: vi.fn() };
    const service = new RemoteBackupPeerService(
      { remoteBackupPeer: { updateMany } } as never,
      audit as never,
    );

    await expect(service.revoke('household-1', 'peer-1')).resolves.toMatchObject({
      revokedAt: expect.any(Date),
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'peer-1',
          userId: 'household-1',
          status: { not: RemoteBackupPeerStatus.REVOKED },
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.peer_revoked', {
      peerId: 'peer-1',
    });
  });

  it('does not reveal another household peer through revocation', async () => {
    const service = new RemoteBackupPeerService(
      { remoteBackupPeer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as never,
      { log: vi.fn() } as never,
    );

    await expect(service.revoke('household-1', 'peer-2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets a schedule only on a paired peer owned by the household', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new RemoteBackupPeerService(
      { remoteBackupPeer: { updateMany } } as never,
      { log: vi.fn() } as never,
    );

    await expect(
      service.setSyncSchedule('household-1', 'peer-1', RemoteBackupSyncSchedule.DAILY),
    ).resolves.toEqual({ syncSchedule: RemoteBackupSyncSchedule.DAILY });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'peer-1',
          userId: 'household-1',
          status: RemoteBackupPeerStatus.PAIRED,
          direction: { not: 'PULL' },
        },
        data: { syncSchedule: RemoteBackupSyncSchedule.DAILY, lastError: null },
      }),
    );
  });
});
