import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiBase } from './api-client';

describe('API base URL', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
