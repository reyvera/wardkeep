import { Controller, Headers, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { AdvisorService } from './advisor.service';

const PURPOSE = 'wardkeep:daily-advisor-brief-worker:v1';

@Controller('internal/advisor')
export class AdvisorInternalController {
  constructor(private readonly advisor: AdvisorService) {}

  @Post('briefs')
  async generateDailyBriefs(@Headers('x-wardkeep-worker-token') supplied?: string) {
    const key = process.env['ENCRYPTION_KEY'];
    if (!key) throw new ServiceUnavailableException('Worker authentication is not configured');
    const expected = Buffer.from(createHmac('sha256', key).update(PURPOSE).digest('hex'));
    const received = Buffer.from(supplied ?? '');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Invalid worker credential');
    }
    return this.advisor.generateDailyBriefs();
  }
}
