import { Injectable, UnauthorizedException } from '@nestjs/common';

import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  REMOTE_BACKUP_CLOCK_SKEW_MS,
  RemoteBackupSignedHeaders,
  verifyRemoteBackupSignature,
} from './remote-backup-auth';
import { RemoteBackupNonceService } from './remote-backup-nonce.service';

@Injectable()
export class RemoteBackupPeerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly nonces: RemoteBackupNonceService,
  ) {}

  /** Authenticates signed headers before a streamed blob reaches storage. */
  async authenticateHeaders(
    request: {
      peerId: string;
      method: string;
      path: string;
      headers: Pick<
        RemoteBackupSignedHeaders,
        | 'x-wardkeep-timestamp'
        | 'x-wardkeep-nonce'
        | 'x-wardkeep-content-sha256'
        | 'x-wardkeep-signature'
      >;
    },
    now = new Date(),
  ) {
    const peer = await this.prisma.remoteBackupPeer.findFirst({
      where: { remotePeerId: request.peerId, status: 'PAIRED' },
      select: { id: true, userId: true, sharedSecret: true, direction: true },
    });
    if (!peer?.sharedSecret) throw new UnauthorizedException('Remote backup authentication failed');

    let secret: string;
    try {
      secret = this.encryption.decrypt(peer.sharedSecret);
    } catch {
      throw new UnauthorizedException('Remote backup authentication failed');
    }

    if (!verifyRemoteBackupSignature({ secret, ...request, now })) {
      throw new UnauthorizedException('Remote backup authentication failed');
    }

    const timestamp = new Date(request.headers['x-wardkeep-timestamp']);
    const claimed = await this.nonces.claim(
      peer.id,
      request.headers['x-wardkeep-nonce'],
      new Date(timestamp.getTime() + REMOTE_BACKUP_CLOCK_SKEW_MS),
      now,
    );
    if (!claimed) throw new UnauthorizedException('Remote backup authentication failed');

    return { peerId: peer.id, userId: peer.userId, direction: peer.direction };
  }
}
