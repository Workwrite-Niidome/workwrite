import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@workwrite/shared'],
  output: 'standalone',
};

export default nextConfig;
