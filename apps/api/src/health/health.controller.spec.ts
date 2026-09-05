import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HealthController', () => {
  it('returns ok when the database is reachable', async () => {
    const controller = new HealthController({ $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as never);

    await expect(controller.check()).resolves.toMatchObject({ status: 'ok', services: { database: 'up' } });
  });

  it('fails the HTTP health check when the database is unavailable', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const controller = new HealthController({ $queryRaw: vi.fn().mockRejectedValue(new Error('database down')) } as never);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
