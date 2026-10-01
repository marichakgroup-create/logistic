import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@loadlink/core'],
  async rewrites() {
    return [{ source: '/v1/:path*', destination: `${process.env.API_URL ?? 'http://127.0.0.1:3001'}/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }];
  },
};
export default config;
