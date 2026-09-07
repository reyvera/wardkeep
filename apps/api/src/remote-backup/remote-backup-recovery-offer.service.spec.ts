import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RemoteBackupRecoveryOfferService } from './remote-backup-recovery-offer.service';
import { hashRemoteBackupPairingSecret } from './remote-backup-pairing';

describe('RemoteBackupRecoveryOfferService', () => {
  it('creates a short-lived hashed offer only for a portable archive', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'offer-1' });
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new RemoteBackupRecoveryOfferService({
      remoteBackup: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'backup-1',
            recoveryClass: RemoteBackupRecoveryClass.PORTABLE_MANUAL,
          }),
      },
      remoteBackupRecoveryOffer: { create },
    } as never, audit as never);
    const now = new Date('2026-09-06T00:00:00.000Z');
    const offer = await service.create('household-1', 'backup-1', now);
    expect(offer.secret).toBeTruthy();
    expect(offer.expiresAt).toEqual(new Date('2026-09-06T00:15:00.000Z'));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ remoteBackupId: 'backup-1' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.recovery_offer_created', {
      offerId: 'offer-1', remoteBackupId: 'backup-1',
    });
  });

  it('rejects a source-tied archive and missing household archive', async () => {
    const sourceTied = new RemoteBackupRecoveryOfferService({
      remoteBackup: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: 'backup-1',
            recoveryClass: RemoteBackupRecoveryClass.SOURCE_TIED_AUTOMATED,
          }),
      },
    } as never, { log: vi.fn() } as never);
    await expect(sourceTied.create('household-1', 'backup-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const missing = new RemoteBackupRecoveryOfferService({
      remoteBackup: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never, { log: vi.fn() } as never);
    await expect(missing.create('household-1', 'backup-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('redeems a valid offer once and creates a short-lived download session', async () => {
    const secret = 'a'.repeat(43);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const sessionCreate = vi.fn().mockResolvedValue({ id: 'session-1' });
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new RemoteBackupRecoveryOfferService({
      remoteBackupRecoveryOffer: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'offer-1',
          secretHash: hashRemoteBackupPairingSecret(secret),
          expiresAt: new Date('2026-09-06T00:15:00.000Z'),
          redeemedAt: null,
          revokedAt: null,
          remoteBackup: { id: 'backup-1', userId: 'household-1', size: 12n, checksum: 'b'.repeat(64) },
        }),
        updateMany,
      },
      remoteBackupRecoverySession: { create: sessionCreate },
    } as never, audit as never);
    const now = new Date('2026-09-06T00:00:00.000Z');

    const redeemed = await service.redeem('offer-1', secret, now);

    expect(redeemed).toEqual({
      remoteBackupId: 'backup-1',
      size: 12,
      checksum: 'b'.repeat(64),
      sessionToken: expect.any(String),
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'offer-1' }) }),
    );
    expect(sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          remoteBackupId: 'backup-1',
          expiresAt: new Date('2026-09-06T00:15:00.000Z'),
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.recovery_offer_redeemed', {
      offerId: 'offer-1', remoteBackupId: 'backup-1',
    });
  });

  it('rejects expired offers and already-consumed recovery sessions', async () => {
    const service = new RemoteBackupRecoveryOfferService({
      remoteBackupRecoveryOffer: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'offer-1',
          secretHash: hashRemoteBackupPairingSecret('a'.repeat(43)),
          expiresAt: new Date('2026-09-05T23:59:59.000Z'),
          redeemedAt: null,
          revokedAt: null,
          remoteBackup: { id: 'backup-1', userId: 'household-1', size: 12n, checksum: 'b'.repeat(64) },
        }),
      },
      remoteBackupRecoverySession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session-1',
          remoteBackupId: 'backup-1',
          expiresAt: new Date('2026-09-06T00:15:00.000Z'),
          consumedAt: new Date('2026-09-06T00:00:00.000Z'),
        }),
      },
    } as never, { log: vi.fn() } as never);

    await expect(service.redeem('offer-1', 'a'.repeat(43), new Date('2026-09-06T00:00:00.000Z'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.consumeSession('a'.repeat(43), new Date('2026-09-06T00:00:01.000Z'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('consumes a valid download session once and audits the archive access', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new RemoteBackupRecoveryOfferService({
      remoteBackupRecoverySession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session-1',
          remoteBackupId: 'backup-1',
          expiresAt: new Date('2026-09-06T00:15:00.000Z'),
          consumedAt: null,
          remoteBackup: { userId: 'household-1' },
        }),
        updateMany,
      },
    } as never, audit as never);

    await expect(service.consumeSession('s'.repeat(43), new Date('2026-09-06T00:00:00.000Z'))).resolves.toBe(
      'backup-1',
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'session-1' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith('household-1', 'remote_backup.recovery_archive_downloaded', {
      remoteBackupId: 'backup-1',
    });
  });
});
