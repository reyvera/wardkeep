import { Injectable, NotFoundException } from '@nestjs/common';
import { RemoteBackupPeerStatus } from '@prisma/client';

import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const peerSelect = {
  id: true,
  peerUrl: true,
  peerName: true,
  direction: true,
  status: true,
  lastSyncAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class RemoteBackupPeerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lists only the requesting household's non-secret peer metadata. */
  list(userId: string) {
    return this.prisma.remoteBackupPeer.findMany({
      where: { userId },
      select: peerSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Revocation stops all future peer requests but deliberately keeps blobs. */
  async revoke(userId: string, peerId: string) {
    const result = await this.prisma.remoteBackupPeer.updateMany({
      where: { id: peerId, userId, status: { not: RemoteBackupPeerStatus.REVOKED } },
      data: { status: RemoteBackupPeerStatus.REVOKED, lastError: null },
    });
    if (result.count !== 1) throw new NotFoundException('Remote backup peer is unavailable');

    await this.audit.log(userId, 'remote_backup.peer_revoked', { peerId });
    return { revokedAt: new Date() };
  }
}
