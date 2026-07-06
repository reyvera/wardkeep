/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@wardkeep/shared'],
};

module.exports = nextConfig;
