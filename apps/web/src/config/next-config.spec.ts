import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config.js';

type Header = { key: string; value: string };
type NextConfigWithRoutes = {
  headers: () => Promise<Array<{ source: string; headers: Header[] }>>;
  rewrites: () => Promise<Array<{ source: string; destination: string }>>;
};

const config = nextConfig as NextConfigWithRoutes;

describe('web deployment configuration', () => {
  it('sends the browser protection headers on every route', async () => {
    const routes = await config.headers();

    expect(routes).toContainEqual({
      source: '/:path*',
      headers: expect.arrayContaining([
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
      ]),
    });
  });

  it('prevents the proxied household API responses from being cached', async () => {
    await expect(config.headers()).resolves.toContainEqual({
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
    });
  });

  it('proxies browser API paths to the internal service', async () => {
    await expect(config.rewrites()).resolves.toContainEqual({
      source: '/api/:path*',
      destination: 'http://api:4000/api/:path*',
    });
  });
});
