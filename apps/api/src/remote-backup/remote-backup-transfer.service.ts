import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RemoteBackupPeerDirection, RemoteBackupPeerStatus } from '@prisma/client';

import { BackupService } from '../backup/backup.service';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { uploadRemoteBackupBlob } from './remote-backup-transfer-client';

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
}
