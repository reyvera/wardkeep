import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { BackupService } from './backup.service';

const WORKER_TOKEN_PURPOSE = 'wardkeep:scheduled-backup-worker:v1';

function workerToken(encryptionKey: string): string {
  return createHmac('sha256', encryptionKey).update(WORKER_TOKEN_PURPOSE).digest('hex');
}

@Controller('internal/backups')
export class BackupInternalController {
  constructor(private readonly backupService: BackupService) {}

  /** Restricted to the local worker through a token derived from the deployment key. */
  @Post('run-due')
  async runDueScheduledBackups(@Headers('x-wardkeep-worker-token') suppliedToken?: string) {
    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new ServiceUnavailableException('Worker authentication is not configured');
    }

    const expected = Buffer.from(workerToken(encryptionKey));
    const supplied = Buffer.from(suppliedToken ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid worker credential');
    }

    return this.backupService.runDueScheduledBackups();
  }
}
