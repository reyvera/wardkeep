import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RemoteBackupPeerDirection } from '@prisma/client';

import { EncryptionService } from '../common/services/encryption.service';
import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createRemoteBackupPairingSecret,
  hashRemoteBackupPairingSecret,
  isRemoteBackupPairingOfferRedeemable,
  remoteBackupPairingOfferExpiry,
  verifyRemoteBackupPairingSecret,
} from './remote-backup-pairing';

@Injectable()
export class RemoteBackupPairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async createOffer(
    userId: string,
    input: { direction: RemoteBackupPeerDirection; peerName?: string },
    now = new Date(),
  ) {
    const secret = createRemoteBackupPairingSecret();
    const expiresAt = remoteBackupPairingOfferExpiry(now);
    const offer = await this.prisma.remoteBackupPairingOffer.create({
      data: {
        userId,
        secretHash: hashRemoteBackupPairingSecret(secret),
        direction: input.direction,
        peerName: input.peerName,
        expiresAt,
      },
    });

    await this.audit.log(userId, 'remote_backup.offer_created', {
      offerId: offer.id,
      direction: offer.direction,
    });
    return { offerId: offer.id, secret, direction: offer.direction, expiresAt: offer.expiresAt };
  }

  async revokeOffer(userId: string, offerId: string, now = new Date()) {
    const result = await this.prisma.remoteBackupPairingOffer.updateMany({
      where: { id: offerId, userId, redeemedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    if (result.count !== 1) throw new NotFoundException('Pairing offer is unavailable');
    await this.audit.log(userId, 'remote_backup.offer_revoked', { offerId });
    return { revokedAt: now };
  }

  /** Consumes a receiver-created offer and records the sender as an authenticated peer. */
  async redeemOffer(
    input: {
      offerId: string;
      secret: string;
      remotePeerId: string;
      peerUrl: string;
      peerName: string;
      direction: RemoteBackupPeerDirection;
    },
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.remoteBackupPairingOffer.findUnique({ where: { id: input.offerId } });
      if (
        !offer ||
        !isRemoteBackupPairingOfferRedeemable(offer, now) ||
        !verifyRemoteBackupPairingSecret(input.secret, offer.secretHash)
      ) {
        throw new BadRequestException('Pairing offer is unavailable');
      }

      const redeemed = await tx.remoteBackupPairingOffer.updateMany({
        where: {
          id: offer.id,
          redeemedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { redeemedAt: now },
      });
      if (redeemed.count !== 1) throw new ConflictException('Pairing offer was already used');

      const peer = await tx.remoteBackupPeer.create({
        data: {
          userId: offer.userId,
          remotePeerId: input.remotePeerId,
          peerUrl: input.peerUrl,
          peerName: input.peerName,
          sharedSecret: this.encryption.encrypt(input.secret),
          direction: input.direction,
          status: 'PAIRED',
        },
      });
      await this.audit.log(offer.userId, 'remote_backup.offer_redeemed', {
        offerId: offer.id,
        remotePeerId: input.remotePeerId,
        direction: input.direction,
      });
      return peer;
    });
  }
}
