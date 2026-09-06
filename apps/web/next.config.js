/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@wardkeep/shared'],
  async rewrites() {
    const apiUrl = (process.env.INTERNAL_API_URL ??
      (process.env.NODE_ENV === 'development' ? 'http://localhost:4000/api' : 'http://api:4000/api')
    ).replace(/\/$/, '');

    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

module.exports = nextConfig;
