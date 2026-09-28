#!/usr/bin/env node
/**
 * Root preinstall guard: this workspace is installed with pnpm only (see packageManager).
 * `npm install` at the root writes a flat node_modules and package-lock.json beside the pnpm
 * tree; `npx next build` then loads two Next.js copies and fails with
 * "Invariant: Expected workStore to be initialized".
 */
import { pathToFileURL } from 'node:url';

export function packageManagerVerdict(userAgent) {
  const agent = typeof userAgent === 'string' ? userAgent.trim() : '';
  if (!agent) return { ok: true };
  const name = agent.split('/')[0];
  if (name === 'pnpm') return { ok: true };
  return {
    ok: false,
    message: `This workspace must be installed with pnpm, not ${name}. Run: corepack enable && pnpm install\n`
      + 'If an npm install already ran, delete node_modules and package-lock.json first.',
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const verdict = packageManagerVerdict(process.env.npm_config_user_agent);
  if (!verdict.ok) {
    process.stderr.write(`${verdict.message}\n`);
    process.exit(1);
  }
}
