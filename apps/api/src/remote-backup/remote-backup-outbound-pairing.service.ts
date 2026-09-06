import {
  BadGatewayException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RemoteBackupPeerDirection, RemoteBackupPeerStatus } from '@prisma/client';
import { z } from 'zod';

import { AuditService } from '../common/services/audit.service';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { redeemRemoteBackupOffer } from './remote-backup-pairing-client';
import {
  hashRemoteBackupPairingSecret,
  verifyRemoteBackupPairingSecret,
} from './remote-backup-pairing';
import { getRemoteBackupPublicUrl } from './remote-backup-public-url';
import {
  resolveRemoteBackupPeerAddresses,
  resolveRemoteBackupPeerUrl,
} from './remote-backup-peer-url';

const redeemResponseSchema = z.object({
  peerId: z.string().uuid(),
  remotePeerId: z.string().uuid(),
  status: z.literal(RemoteBackupPeerStatus.PAIRED),
});

@Injectable()
export class RemoteBackupOutboundPairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a durable pending peer before contacting the receiver. A retry of
   * the same offer therefore retains the same local peer ID and is safe even
   * when the first response was lost after the receiver committed pairing.
   */
  async connect(
    userId: string,
    input: {
      offerId: string;
      secret: string;
      peerUrl: string;
      peerName: string;
      localPeerName: string;
      direction: RemoteBackupPeerDirection;
    },
  ) {
    let senderUrl: string;
    let receiverUrl: string;
    try {
      senderUrl = await getRemoteBackupPublicUrl();
      receiverUrl = (
        await resolveRemoteBackupPeerUrl(input.peerUrl, resolveRemoteBackupPeerAddresses)
      ).url.origin;
    } catch {
      throw new BadGatewayException('Remote backup public URLs are unavailable or unsafe');
    }

    const localPeer = await this.getOrCreatePendingPeer(userId, input, receiverUrl);

    let response: unknown;
    try {
      response = await redeemRemoteBackupOffer(receiverUrl, {
        offerId: input.offerId,
        secret: input.secret,
        remotePeerId: localPeer.id,
        peerUrl: senderUrl,
        peerName: input.localPeerName,
        direction: input.direction,
      });
    } catch {
      await this.prisma.remoteBackupPeer.updateMany({
        where: { id: localPeer.id, status: RemoteBackupPeerStatus.PENDING },
        data: { lastError: 'Pairing request did not complete' },
      });
      throw new ServiceUnavailableException('Remote backup pairing did not complete; retry safely');
    }

    const parsed = redeemResponseSchema.safeParse(response);
    if (!parsed.success || parsed.data.remotePeerId !== localPeer.id) {
      throw new BadGatewayException('Remote backup pairing returned an invalid response');
    }

    const updated = await this.prisma.remoteBackupPeer.updateMany({
      where: {
        id: localPeer.id,
        userId,
        pairingOfferId: input.offerId,
        status: RemoteBackupPeerStatus.PENDING,
      },
      data: {
        remotePeerId: parsed.data.peerId,
        status: RemoteBackupPeerStatus.PAIRED,
        lastError: null,
        lastSyncAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      const paired = await this.prisma.remoteBackupPeer.findFirst({
        where: {
          id: localPeer.id,
          userId,
          remotePeerId: parsed.data.peerId,
          status: RemoteBackupPeerStatus.PAIRED,
        },
        select: { id: true, remotePeerId: true, status: true },
      });
      if (paired) return this.pairedPeerResponse(paired);
      throw new ConflictException('Remote backup pairing state changed; do not retry this offer');
    }

    await this.audit.log(userId, 'remote_backup.pairing_completed', {
      peerId: localPeer.id,
      remotePeerId: parsed.data.peerId,
    });
    return this.pairedPeerResponse({
      id: localPeer.id,
      remotePeerId: parsed.data.peerId,
      status: RemoteBackupPeerStatus.PAIRED,
    });
  }

  private async getOrCreatePendingPeer(
    userId: string,
    input: {
      offerId: string;
      secret: string;
      peerName: string;
      direction: RemoteBackupPeerDirection;
    },
    peerUrl: string,
  ) {
    const existing = await this.prisma.remoteBackupPeer.findUnique({
      where: { userId_peerUrl: { userId, peerUrl } },
    });
    if (existing) {
      if (
        existing.status !== RemoteBackupPeerStatus.PENDING ||
        existing.pairingOfferId !== input.offerId ||
        existing.peerName !== input.peerName ||
        existing.direction !== input.direction ||
        !existing.sharedSecret ||
        !this.matchesPairingSecret(input.secret, existing.sharedSecret)
      ) {
        throw new ConflictException('A different remote backup peer already uses this URL');
      }
      return existing;
    }

    const peer = await this.prisma.remoteBackupPeer.create({
      data: {
        userId,
        peerUrl,
        peerName: input.peerName,
        direction: input.direction,
        pairingOfferId: input.offerId,
        sharedSecret: this.encryption.encrypt(input.secret),
        status: RemoteBackupPeerStatus.PENDING,
      },
    });
    await this.audit.log(userId, 'remote_backup.pairing_started', {
      peerId: peer.id,
      peerUrl,
      direction: input.direction,
    });
    return peer;
  }

  private matchesPairingSecret(secret: string, encryptedSecret: string): boolean {
    try {
      return verifyRemoteBackupPairingSecret(
        secret,
        hashRemoteBackupPairingSecret(this.encryption.decrypt(encryptedSecret)),
      );
    } catch {
      return false;
    }
  }

  private pairedPeerResponse(peer: { id: string; remotePeerId: string | null; status: string }) {
    return { peerId: peer.id, remotePeerId: peer.remotePeerId, status: peer.status };
  }
}
