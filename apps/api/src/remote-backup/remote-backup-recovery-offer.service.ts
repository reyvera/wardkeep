import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';

import { AuditService } from '../common/services/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createRemoteBackupPairingSecret,
  hashRemoteBackupPairingSecret,
  verifyRemoteBackupPairingSecret,
} from './remote-backup-pairing';

const RECOVERY_OFFER_TTL_MS = 15 * 60 * 1000;

/** Creates single-use recovery credentials without exposing a regular peer secret. */
@Injectable()
export class RemoteBackupRecoveryOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, remoteBackupId: string, now = new Date()) {
    const archive = await this.prisma.remoteBackup.findFirst({
      where: { id: remoteBackupId, userId },
      select: { id: true, recoveryClass: true },
    });
    if (!archive) throw new NotFoundException('Remote backup is unavailable');
    if (archive.recoveryClass !== RemoteBackupRecoveryClass.PORTABLE_MANUAL) {
      throw new BadRequestException('Only portable manual backups can create a recovery offer');
    }
    const secret = createRemoteBackupPairingSecret();
    const expiresAt = new Date(now.getTime() + RECOVERY_OFFER_TTL_MS);
    const offer = await this.prisma.remoteBackupRecoveryOffer.create({
      data: {
        remoteBackupId: archive.id,
        secretHash: hashRemoteBackupPairingSecret(secret),
        expiresAt,
      },
    });
    await this.audit.log(userId, 'remote_backup.recovery_offer_created', {
      offerId: offer.id,
      remoteBackupId: archive.id,
    });
    return { offerId: offer.id, secret, expiresAt };
  }

  /** Consumes an offer exactly once; archive download authorization remains separate. */
  async redeem(offerId: string, secret: string, now = new Date()) {
    const offer = await this.prisma.remoteBackupRecoveryOffer.findUnique({
      where: { id: offerId },
      include: { remoteBackup: { select: { id: true, userId: true, size: true, checksum: true } } },
    });
    if (
      !offer ||
      offer.redeemedAt ||
      offer.revokedAt ||
      offer.expiresAt <= now ||
      !verifyRemoteBackupPairingSecret(secret, offer.secretHash)
    ) {
      throw new NotFoundException('Recovery offer is unavailable');
    }
    const consumed = await this.prisma.remoteBackupRecoveryOffer.updateMany({
      where: { id: offer.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { redeemedAt: now },
    });
    if (consumed.count !== 1) throw new NotFoundException('Recovery offer is unavailable');
    const sessionToken = createRemoteBackupPairingSecret();
    await this.prisma.remoteBackupRecoverySession.create({
      data: {
        remoteBackupId: offer.remoteBackup.id,
        tokenHash: hashRemoteBackupPairingSecret(sessionToken),
        expiresAt: new Date(now.getTime() + RECOVERY_OFFER_TTL_MS),
      },
    });
    await this.audit.log(offer.remoteBackup.userId, 'remote_backup.recovery_offer_redeemed', {
      offerId: offer.id,
      remoteBackupId: offer.remoteBackup.id,
    });
    return {
      remoteBackupId: offer.remoteBackup.id,
      size: Number(offer.remoteBackup.size),
      checksum: offer.remoteBackup.checksum,
      sessionToken,
    };
  }

  /** Atomically consumes one valid download token and returns its archive ID. */
  async consumeSession(sessionToken: string, now = new Date()) {
    const tokenHash = hashRemoteBackupPairingSecret(sessionToken);
    const session = await this.prisma.remoteBackupRecoverySession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        remoteBackupId: true,
        expiresAt: true,
        consumedAt: true,
        remoteBackup: { select: { userId: true } },
      },
    });
    if (!session || session.consumedAt || session.expiresAt <= now) throw new NotFoundException('Recovery session is unavailable');
    const consumed = await this.prisma.remoteBackupRecoverySession.updateMany({
      where: { id: session.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new NotFoundException('Recovery session is unavailable');
    await this.audit.log(session.remoteBackup.userId, 'remote_backup.recovery_archive_downloaded', {
      remoteBackupId: session.remoteBackupId,
    });
    return session.remoteBackupId;
  }
}
