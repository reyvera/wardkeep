import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, getApiBase } from './api-client';
import { offlineQueue } from './offline-queue';

describe('API base URL', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the same-origin API proxy in browser contexts', () => {
    vi.stubGlobal('window', { location: { origin: 'https://wardkeep.example' } });

    expect(getApiBase()).toBe('/api');
  });

  it('uses the internal API address outside the browser', () => {
    vi.stubGlobal('window', undefined);
    const original = process.env.INTERNAL_API_URL;
    process.env.INTERNAL_API_URL = 'http://api:4000/api';

    expect(getApiBase()).toBe('http://api:4000/api');

    if (original === undefined) delete process.env.INTERNAL_API_URL;
    else process.env.INTERNAL_API_URL = original;
  });

  it('never queues a readiness comparison while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const queueAdd = vi.spyOn(offlineQueue, 'add');

    await expect(apiClient.post('/readiness/scenario', { changes: [] })).rejects.toThrow('offline');

    expect(queueAdd).not.toHaveBeenCalled();
  });
});
