import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdvisorInternalController } from './advisor-internal.controller';

describe('AdvisorInternalController', () => {
  const originalKey = process.env['ENCRYPTION_KEY'];
  afterEach(() => { process.env['ENCRYPTION_KEY'] = originalKey; });

  it('accepts only the deployment-derived daily-brief worker credential', async () => {
    process.env['ENCRYPTION_KEY'] = 'test-key';
    const generateDailyBriefs = vi.fn().mockResolvedValue({ generated: 1, failed: 0 });
    const controller = new AdvisorInternalController({ generateDailyBriefs } as never);
    const token = createHmac('sha256', 'test-key').update('wardkeep:daily-advisor-brief-worker:v1').digest('hex');

    await expect(controller.generateDailyBriefs(token)).resolves.toEqual({ generated: 1, failed: 0 });
    await expect(controller.generateDailyBriefs('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
