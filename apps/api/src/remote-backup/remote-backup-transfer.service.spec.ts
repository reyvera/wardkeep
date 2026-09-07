import {
  RemoteBackupPeerDirection,
  RemoteBackupPeerStatus,
  RemoteBackupSyncSchedule,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./remote-backup-transfer-client', () => ({
  checkRemoteBackupHealth: vi.fn().mockResolvedValue(undefined),
  downloadRemoteBackupBlob: vi.fn(),
  listRemoteBackupBlobs: vi.fn(),
  uploadRemoteBackupBlob: vi.fn(),
}));

import { RemoteBackupTransferService } from './remote-backup-transfer.service';

describe('RemoteBackupTransferService scheduled syncs', () => {
  it('creates and sends one automatic backup for each due push-capable peer', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'peer-due',
        userId: 'household-1',
        peerUrl: 'https://peer.example',
        sharedSecret: 'encrypted-secret',
        direction: RemoteBackupPeerDirection.BOTH,
        syncSchedule: RemoteBackupSyncSchedule.DAILY,
        lastSyncAt: new Date('2026-09-05T00:00:00.000Z'),
      },
    ]);
    const createScheduledBackup = vi.fn().mockResolvedValue({ id: 'backup-1' });
    const service = new RemoteBackupTransferService(
      { remoteBackupPeer: { findMany, updateMany: vi.fn() } } as never,
      { decrypt: vi.fn().mockReturnValue('secret') } as never,
      { createScheduledBackup } as never,
    );
    const push = vi.fn().mockResolvedValue({});
    (service as unknown as { push: typeof push }).push = push;

    await expect(
      service.runDueScheduledSyncs(new Date('2026-09-06T00:00:00.000Z')),
    ).resolves.toEqual({
      synced: 1,
      failed: 0,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [RemoteBackupPeerStatus.PAIRED, RemoteBackupPeerStatus.UNREACHABLE],
          },
        }),
      }),
    );
    expect(createScheduledBackup).toHaveBeenCalledWith('household-1');
    expect(push).toHaveBeenCalledWith('household-1', 'peer-due', 'backup-1');
  });

  it('records a safe peer-level error when a scheduled copy fails', async () => {
    const updateMany = vi.fn();
    const service = new RemoteBackupTransferService(
      {
        remoteBackupPeer: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'peer-due',
              userId: 'household-1',
              peerUrl: 'https://peer.example',
              sharedSecret: 'encrypted-secret',
              direction: RemoteBackupPeerDirection.BOTH,
              syncSchedule: RemoteBackupSyncSchedule.HOURLY,
              lastSyncAt: null,
            },
          ]),
          updateMany,
        },
      } as never,
      { decrypt: vi.fn().mockReturnValue('secret') } as never,
      { createScheduledBackup: vi.fn().mockRejectedValue(new Error('offline')) } as never,
    );

    await expect(service.runDueScheduledSyncs()).resolves.toEqual({ synced: 0, failed: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: 'Scheduled encrypted copy did not complete',
          consecutiveFailures: 1,
        }),
      }),
    );
  });

  it('marks a peer unreachable after its third consecutive failure', async () => {
    const updateMany = vi.fn();
    const service = new RemoteBackupTransferService(
      { remoteBackupPeer: { updateMany } } as never,
      {} as never,
      {} as never,
    );

    await (
      service as unknown as {
        recordPeerFailure(
          peer: { id: string; userId: string; consecutiveFailures: number },
          message: string,
        ): Promise<void>;
      }
    ).recordPeerFailure({ id: 'peer-1', userId: 'household-1', consecutiveFailures: 2 }, 'offline');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consecutiveFailures: 3,
          status: RemoteBackupPeerStatus.UNREACHABLE,
        }),
      }),
    );
  });
});
