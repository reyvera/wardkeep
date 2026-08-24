import {
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { ReadinessService } from './readiness.service';

const WORKER_TOKEN_PURPOSE = 'wardkeep:readiness-snapshot-worker:v1';

function workerToken(encryptionKey: string): string {
  return createHmac('sha256', encryptionKey).update(WORKER_TOKEN_PURPOSE).digest('hex');
}

@Controller('internal/readiness')
export class ReadinessInternalController {
  constructor(private readonly readinessService: ReadinessService) {}

  /**
   * Restricted to the local worker. Its credential is derived from the existing
   * deployment encryption key, so no browser session can invoke it.
   */
  @Post('snapshots')
  async recordDailySnapshots(@Headers('x-wardkeep-worker-token') suppliedToken?: string) {
    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new ServiceUnavailableException('Worker authentication is not configured');
    }

    const expectedToken = workerToken(encryptionKey);
    const supplied = Buffer.from(suppliedToken ?? '');
    const expected = Buffer.from(expectedToken);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid worker credential');
    }

    return this.readinessService.recordDailySnapshots();
  }
}
