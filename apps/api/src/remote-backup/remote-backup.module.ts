import { Module } from '@nestjs/common';

import { RemoteBackupPairingController } from './remote-backup-pairing.controller';
import { RemoteBackupInternalController } from './remote-backup-internal.controller';
import { RemoteBackupBlobController } from './remote-backup-blob.controller';
import { RemoteBackupPeerController } from './remote-backup-peer.controller';
import { RemoteBackupNonceService } from './remote-backup-nonce.service';
import { RemoteBackupPeerAuthService } from './remote-backup-peer-auth.service';
import { RemoteBackupPeerService } from './remote-backup-peer.service';
import { RemoteBackupPairingService } from './remote-backup-pairing.service';
import { RemoteBackupOutboundPairingService } from './remote-backup-outbound-pairing.service';
import { RemoteBackupStorageService } from './remote-backup-storage.service';
import { RemoteBackupTransferService } from './remote-backup-transfer.service';
import { RemoteBackupRecoveryOfferService } from './remote-backup-recovery-offer.service';
import { RemoteBackupRecoveryImportService } from './remote-backup-recovery-import.service';
import { RemoteBackupRecoveryImportController } from './remote-backup-recovery-import.controller';
import {
  RemoteBackupRecoveryOfferController,
  RemoteBackupRecoveryRedemptionController,
} from './remote-backup-recovery-offer.controller';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [BackupModule],
  controllers: [
    RemoteBackupBlobController,
    RemoteBackupInternalController,
    RemoteBackupPairingController,
    RemoteBackupPeerController,
    RemoteBackupRecoveryOfferController,
    RemoteBackupRecoveryRedemptionController,
    RemoteBackupRecoveryImportController,
  ],
  providers: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPeerService,
    RemoteBackupPairingService,
    RemoteBackupOutboundPairingService,
    RemoteBackupStorageService,
    RemoteBackupTransferService,
    RemoteBackupRecoveryOfferService,
    RemoteBackupRecoveryImportService,
  ],
  exports: [
    RemoteBackupNonceService,
    RemoteBackupPeerAuthService,
    RemoteBackupPeerService,
    RemoteBackupPairingService,
    RemoteBackupOutboundPairingService,
    RemoteBackupStorageService,
    RemoteBackupTransferService,
  ],
})
export class RemoteBackupModule {}
