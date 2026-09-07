import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { RemoteBackupTransferService } from './remote-backup-transfer.service';

const WORKER_TOKEN_PURPOSE = 'wardkeep:scheduled-remote-backup-worker:v1';

function workerToken(encryptionKey: string): string {
  return createHmac('sha256', encryptionKey).update(WORKER_TOKEN_PURPOSE).digest('hex');
}

@Controller('internal/remote-backups')
export class RemoteBackupInternalController {
  constructor(private readonly transfers: RemoteBackupTransferService) {}

  /** Runs due encrypted-copy schedules only for the local worker. */
  @Post('run-due')
  async runDue(@Headers('x-wardkeep-worker-token') suppliedToken?: string) {
    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new ServiceUnavailableException('Worker authentication is not configured');
    }
    const expected = Buffer.from(workerToken(encryptionKey));
    const supplied = Buffer.from(suppliedToken ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid worker credential');
    }
    return this.transfers.runDueScheduledSyncs();
  }
}
