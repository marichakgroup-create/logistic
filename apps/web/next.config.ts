import type { NextConfig } from 'next';
import { apiOrigin } from './lib/api-origin';
const config: NextConfig = {
  transpilePackages: ['@loadlink/core'],
  async rewrites() {
    return [{ source: '/v1/:path*', destination: `${apiOrigin()}/v1/:path*` }];
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
