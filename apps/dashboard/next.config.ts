import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

export function resolveTurbopackRoot(isVercel = process.env.VERCEL === '1') {
  return fileURLToPath(new URL(isVercel ? '.' : '../..', import.meta.url));
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: resolveTurbopackRoot(),
  },
};

export default nextConfig;
