import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

/**
 * Turbopack must resolve from the pnpm workspace root everywhere, including Vercel.
 * Vercel installs all workspace projects, so `next` lives in <repo>/node_modules/.pnpm,
 * outside apps/dashboard; it also sets outputFileTracingRoot to the repo root. Next
 * 16.2 ignored a mismatched turbopack.root (warned, used outputFileTracingRoot); since
 * Next 16.3.5 an apps/dashboard root fails "Could not find the Next.js package".
 */
export function resolveTurbopackRoot() {
  return fileURLToPath(new URL('../..', import.meta.url));
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: resolveTurbopackRoot(),
  },
};

export default nextConfig;
