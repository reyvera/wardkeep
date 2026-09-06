import { describe, expect, it } from 'vitest';

import { createCorsOptions, resolveCorsOrigins } from './cors';

function checkOrigin(origins: string[], origin?: string): Promise<boolean> {
  const policy = createCorsOptions(origins);
  return new Promise((resolve, reject) => {
    policy.origin(origin, (error, allowed) => {
      if (error) reject(error);
      else resolve(Boolean(allowed));
    });
  });
}

describe('CORS policy', () => {
  it('uses safe local development origins when no value is configured', () => {
    expect(resolveCorsOrigins(undefined)).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('normalizes and deduplicates configured browser origins', () => {
    expect(
      resolveCorsOrigins(
        ' https://wardkeep.example ,https://app.example,https://wardkeep.example ',
      ),
    ).toEqual(['https://wardkeep.example', 'https://app.example']);
  });

  it('allows configured browsers and originless internal callers', async () => {
    await expect(
      checkOrigin(['https://wardkeep.example'], 'https://wardkeep.example'),
    ).resolves.toBe(true);
    await expect(checkOrigin(['https://wardkeep.example'])).resolves.toBe(true);
  });

  it('rejects an unconfigured browser origin', async () => {
    await expect(
      checkOrigin(['https://wardkeep.example'], 'https://untrusted.example'),
    ).rejects.toThrow('Origin is not allowed by CORS');
  });
});
