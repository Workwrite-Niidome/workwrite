import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ultra-reader/shared'],
  output: 'standalone',
};

export default nextConfig;
