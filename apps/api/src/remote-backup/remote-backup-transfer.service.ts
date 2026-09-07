import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  RemoteBackupPeerDirection,
  RemoteBackupPeerStatus,
  RemoteBackupSyncSchedule,
} from '@prisma/client';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BackupService } from '../backup/backup.service';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkRemoteBackupHealth,
  downloadRemoteBackupBlob,
  listRemoteBackupBlobs,
  uploadRemoteBackupBlob,
} from './remote-backup-transfer-client';

@Injectable()
export class RemoteBackupTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly backups: BackupService,
  ) {}

  async push(userId: string, peerId: string, backupId: string) {
    const peer = await this.prisma.remoteBackupPeer.findFirst({
      where: { id: peerId, userId, status: RemoteBackupPeerStatus.PAIRED },
      select: { id: true, remotePeerId: true, peerUrl: true, sharedSecret: true, direction: true },
    });
    if (!peer) throw new NotFoundException('Remote backup peer is unavailable');
    if (peer.direction === RemoteBackupPeerDirection.PULL) {
      throw new BadRequestException('This remote backup peer does not accept uploads');
    }
    if (!peer.remotePeerId || !peer.sharedSecret) {
      throw new BadRequestException('Remote backup peer is incomplete');
    }
    const archive = await this.backups.encryptedArchiveForRemote(userId, backupId);
    const result = await uploadRemoteBackupBlob({
      peerUrl: peer.peerUrl,
      peerId: peer.id,
      secret: this.encryption.decrypt(peer.sharedSecret),
      sourceBackupId: archive.id,
      recoveryClass: archive.recoveryClass,
      createdAt: archive.createdAt,
      path: archive.path,
    });
    await this.prisma.remoteBackupPeer.updateMany({
      where: { id: peer.id, userId, status: RemoteBackupPeerStatus.PAIRED },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    return result;
  }

  /** Lists opaque backups that this paired destination holds for the household. */
  async listRemoteBackups(userId: string, peerId: string) {
    const peer = await this.findPairedPeer(userId, peerId);
    const backups = await listRemoteBackupBlobs({
      peerUrl: peer.peerUrl,
      peerId: peer.id,
      secret: this.encryption.decrypt(peer.sharedSecret),
    });
    return backups;
  }

  /** Downloads, verifies, and restores one remote archive without retaining a local copy. */
  async restoreRemoteBackup(
    userId: string,
    peerId: string,
    remoteBackupId: string,
    passphrase?: string,
  ) {
    const peer = await this.findPairedPeer(userId, peerId);
    const secret = this.encryption.decrypt(peer.sharedSecret);
    const backups = await listRemoteBackupBlobs({ peerUrl: peer.peerUrl, peerId: peer.id, secret });
    const backup = backups.find((candidate) => candidate.id === remoteBackupId);
    if (!backup) throw new NotFoundException('Remote backup is unavailable');

    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-remote-restore-'));
    const archivePath = join(directory, `${backup.id}.enc`);
    try {
      await downloadRemoteBackupBlob({
        peerUrl: peer.peerUrl,
        peerId: peer.id,
        secret,
        backup,
        destinationPath: archivePath,
      });
      const result = await this.backups.restoreRemoteArchive(
        userId,
        archivePath,
        backup.recoveryClass,
        passphrase,
      );
      await this.prisma.remoteBackupPeer.updateMany({
        where: { id: peer.id, userId, status: RemoteBackupPeerStatus.PAIRED },
        data: { lastSyncAt: new Date(), lastError: null },
      });
      return result;
    } finally {
      await unlink(archivePath).catch(() => undefined);
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Checks peer liveness and sends source-tied backups for every schedule that is due. */
  async runDueScheduledSyncs(now = new Date()) {
    const peers = await this.prisma.remoteBackupPeer.findMany({
      where: {
        status: { in: [RemoteBackupPeerStatus.PAIRED, RemoteBackupPeerStatus.UNREACHABLE] },
      },
      select: {
        id: true,
        userId: true,
        peerUrl: true,
        sharedSecret: true,
        direction: true,
        syncSchedule: true,
        lastSyncAt: true,
        consecutiveFailures: true,
      },
    });
    let synced = 0;
    let failed = 0;
    for (const peer of peers) {
      if (!peer.sharedSecret) continue;
      try {
        await checkRemoteBackupHealth({
          peerUrl: peer.peerUrl,
          peerId: peer.id,
          secret: this.encryption.decrypt(peer.sharedSecret),
        });
        await this.prisma.remoteBackupPeer.updateMany({
          where: {
            id: peer.id,
            userId: peer.userId,
            status: { not: RemoteBackupPeerStatus.REVOKED },
          },
          data: { status: RemoteBackupPeerStatus.PAIRED, consecutiveFailures: 0, lastError: null },
        });
      } catch {
        failed++;
        await this.recordPeerFailure(peer, 'Remote backup destination did not respond');
        continue;
      }
      if (
        peer.direction === RemoteBackupPeerDirection.PULL ||
        !this.isSyncDue(peer.syncSchedule, peer.lastSyncAt, now)
      )
        continue;
      try {
        const backup = await this.backups.createScheduledBackup(peer.userId);
        await this.push(peer.userId, peer.id, backup.id);
        synced++;
      } catch {
        failed++;
        await this.recordPeerFailure(
          { ...peer, consecutiveFailures: 0 },
          'Scheduled encrypted copy did not complete',
        );
      }
    }
    return { synced, failed };
  }

  private async findPairedPeer(userId: string, peerId: string) {
    const peer = await this.prisma.remoteBackupPeer.findFirst({
      where: { id: peerId, userId, status: RemoteBackupPeerStatus.PAIRED },
      select: { id: true, peerUrl: true, sharedSecret: true },
    });
    if (!peer?.sharedSecret) throw new NotFoundException('Remote backup peer is unavailable');
    return peer as { id: string; peerUrl: string; sharedSecret: string };
  }

  private isSyncDue(
    schedule: RemoteBackupSyncSchedule | null,
    lastSyncAt: Date | null,
    now: Date,
  ): boolean {
    if (!schedule || !lastSyncAt) return Boolean(schedule);
    const dueAt = new Date(lastSyncAt);
    if (schedule === RemoteBackupSyncSchedule.HOURLY) dueAt.setUTCHours(dueAt.getUTCHours() + 1);
    if (schedule === RemoteBackupSyncSchedule.EVERY_6H) dueAt.setUTCHours(dueAt.getUTCHours() + 6);
    if (schedule === RemoteBackupSyncSchedule.DAILY) dueAt.setUTCDate(dueAt.getUTCDate() + 1);
    if (schedule === RemoteBackupSyncSchedule.WEEKLY) dueAt.setUTCDate(dueAt.getUTCDate() + 7);
    return now >= dueAt;
  }

  private async recordPeerFailure(
    peer: { id: string; userId: string; consecutiveFailures: number },
    message: string,
  ) {
    const consecutiveFailures = peer.consecutiveFailures + 1;
    await this.prisma.remoteBackupPeer.updateMany({
      where: { id: peer.id, userId: peer.userId, status: { not: RemoteBackupPeerStatus.REVOKED } },
      data: {
        consecutiveFailures,
        lastError: message,
        status:
          consecutiveFailures >= 3
            ? RemoteBackupPeerStatus.UNREACHABLE
            : RemoteBackupPeerStatus.PAIRED,
      },
    });
  }
}
