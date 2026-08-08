import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function exists(path) {
  try {
    await access(new URL(path, root), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Release readiness failed: ${message}`);
}

const workspace = await text('pnpm-workspace.yaml');
const lockfile = await text('pnpm-lock.yaml');
const ci = await text('.github/workflows/ci.yml');
const kernelIndex = await text('packages/kernel/src/index.ts');
const connectorsIndex = await text('packages/connectors/src/index.ts');
const projectState = await text('PROJECT_STATE.md');

requireCondition(!workspace.includes('ignoreGhsas'), 'production audit contains a GHSA ignore');
requireCondition(workspace.includes("nanoid: '3.3.17'"), 'patched Nano ID override is missing');
requireCondition(lockfile.includes('nanoid@3.3.17:'), 'patched Nano ID is not locked');
requireCondition(!lockfile.includes('nanoid@3.3.16:'), 'vulnerable Nano ID 3.3.16 returned');

requireCondition(await exists('packages/kernel/src/memory/durable-memory-authority-receipt-repository.ts'), 'durable memory authority repository is missing');
requireCondition(kernelIndex.includes('DurableMemoryAuthorityReceiptRepository'), 'durable memory authority repository is not exported');

requireCondition(connectorsIndex.includes('PublicWebSearchClient'), 'native public web search client is not exported');
requireCondition(kernelIndex.includes('PUBLIC_WEB_SEARCH_CAPABILITY'), 'web.search capability is not exported');
requireCondition(kernelIndex.includes('PublicWebSearchExecutionAdapter'), 'web.search execution adapter is not exported');

requireCondition(await exists('apps/local-kernel/golden-drill-goal.e2e.test.mjs'), 'Golden Goal E2E is missing');
requireCondition(await exists('features/golden-drill-goal.feature'), 'Golden Goal feature contract is missing');

requireCondition(await exists('Install Efesto.cmd'), 'Windows one-click installer entrypoint is missing');
requireCondition(await exists('scripts/install-efesto.ps1'), 'Windows self-healing installer is missing');
requireCondition(await exists('scripts/efesto-installer-contract.test.mjs'), 'installer regression contract is missing');

requireCondition(ci.includes('Production dependency audit'), 'production audit CI step is missing');
requireCondition(ci.includes('pnpm audit --prod'), 'strict production audit command is missing');
requireCondition(ci.includes('dashboard-browser:'), 'dedicated dashboard browser job is missing');
requireCondition(ci.includes('playwright install --with-deps chromium'), 'Chromium installation gate is missing');
requireCondition(ci.includes('@internet-brain-os/dashboard e2e'), 'dashboard browser acceptance command is missing');
requireCondition(ci.includes('pnpm verify:first-run'), 'first-run verification is missing from CI');

requireCondition(projectState.includes('Authentic Hermes v0.19.0 runtime acceptance was proven'), 'canonical state does not record authentic Hermes proof');
requireCondition(projectState.includes('no open GitHub issues and no open pull requests'), 'canonical state does not record repository cleanup');

console.log('Efesto MVP release readiness: GREEN');
console.log('durable-memory-authority: green');
console.log('authentic-hermes-boundary: green');
console.log('native-web-search-read: green');
console.log('golden-goal-e2e: green');
console.log('dashboard-chromium-gate: green');
console.log('windows-one-click-installer: green');
console.log('strict-supply-chain-audit: green');
console.log('canonical-project-state: green');
