import { Injectable } from '@nestjs/common';
import { RemoteBackupRecoveryClass } from '@prisma/client';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BackupService } from '../backup/backup.service';
import {
  downloadRemoteBackupRecoveryArchive,
  redeemRemoteBackupRecoveryOffer,
} from './remote-backup-recovery-client';

/** Performs a fresh-instance portable recovery without persisting the downloaded archive. */
@Injectable()
export class RemoteBackupRecoveryImportService {
  constructor(private readonly backups: BackupService) {}

  async importPortableArchive(input: {
    userId: string;
    peerUrl: string;
    offerId: string;
    secret: string;
    passphrase: string;
  }) {
    const redemption = await redeemRemoteBackupRecoveryOffer(input);
    const directory = await mkdtemp(join(tmpdir(), 'wardkeep-recovery-import-'));
    const archivePath = join(directory, `${redemption.remoteBackupId}.enc`);
    try {
      await downloadRemoteBackupRecoveryArchive({
        peerUrl: input.peerUrl,
        sessionToken: redemption.sessionToken,
        size: redemption.size,
        checksum: redemption.checksum,
        destinationPath: archivePath,
      });
      return this.backups.restoreRemoteArchive(
        input.userId,
        archivePath,
        RemoteBackupRecoveryClass.PORTABLE_MANUAL,
        input.passphrase,
      );
    } finally {
      await unlink(archivePath).catch(() => undefined);
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
