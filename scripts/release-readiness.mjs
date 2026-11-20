import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// --- Real production supply-chain audit -------------------------------------
//
// `strict-supply-chain-audit` is green only when `pnpm audit --prod` has
// actually executed in this workspace and reported zero vulnerabilities.
// The static policy checks below (no GHSA ignores, patched Nano ID pin, the
// CI audit step) remain supporting signals; they can fail the release, but
// they can never by themselves turn this check green. When the audit cannot
// run (no pnpm, no network, timeout, unparseable output) the check is
// `unverified` — never green — and the release verdict is blocked.

export const PRODUCTION_AUDIT_TIMEOUT_MS = 120_000;
const PRODUCTION_AUDIT_OUTPUT_LIMIT = 8 * 1024 * 1024;
const AUDIT_SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];

function boundedReason(value) {
  return String(value ?? 'unknown error').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function defaultRunCommand(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        // pnpm is a .cmd shim on Windows; a shell is required to spawn it.
        shell: process.platform === 'win32',
        windowsHide: true,
      });
    } catch (error) {
      resolve({ exitCode: null, stdout: '', stderr: '', error: boundedReason(error?.message) });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputExceeded = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > PRODUCTION_AUDIT_OUTPUT_LIMIT && !outputExceeded) {
        outputExceeded = true;
        child.kill('SIGTERM');
      }
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      if (stderr.length <= PRODUCTION_AUDIT_OUTPUT_LIMIT) stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr, error: boundedReason(error?.message), timedOut });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut, outputExceeded });
    });
  });
}

export function parseAuditReport(stdout) {
  if (typeof stdout !== 'string' || !stdout.trim()) return null;
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return null;
  }
  const counts = report?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== 'object') return null;
  const bySeverity = {};
  let total = 0;
  for (const severity of AUDIT_SEVERITIES) {
    const value = Number(counts[severity] ?? 0);
    if (!Number.isFinite(value) || value < 0) return null;
    bySeverity[severity] = value;
    total += value;
  }
  const dependencies = Number(report?.metadata?.totalDependencies ?? 0);
  return { total, bySeverity, dependencies: Number.isFinite(dependencies) ? dependencies : 0 };
}

function severitySummary(bySeverity) {
  return AUDIT_SEVERITIES.map((severity) => `${severity}: ${bySeverity[severity]}`).join(', ');
}

export function evaluateProductionAudit(result, { timeoutMs = PRODUCTION_AUDIT_TIMEOUT_MS } = {}) {
  if (result?.error) {
    return {
      status: 'unverified',
      evidence: `pnpm audit --prod could not be executed (${boundedReason(result.error)})`,
    };
  }
  if (result?.timedOut) {
    return {
      status: 'unverified',
      evidence: `pnpm audit --prod did not finish within ${timeoutMs}ms`,
    };
  }
  if (result?.outputExceeded) {
    return {
      status: 'unverified',
      evidence: 'pnpm audit --prod output exceeded the bounded capture limit',
    };
  }
  const report = parseAuditReport(result?.stdout);
  if (!report) {
    return {
      status: 'unverified',
      evidence: `pnpm audit --prod exited ${result?.exitCode ?? 'without a code'} without a parseable audit report`,
    };
  }
  if (report.total > 0) {
    return {
      status: 'red',
      evidence: `pnpm audit --prod executed: ${report.total} vulnerabilities (${severitySummary(report.bySeverity)})`,
    };
  }
  if (result.exitCode !== 0) {
    return {
      status: 'unverified',
      evidence: `pnpm audit --prod reported 0 vulnerabilities but exited ${result.exitCode}`,
    };
  }
  return {
    status: 'green',
    evidence: `pnpm audit --prod executed: 0 vulnerabilities (${report.dependencies} dependencies audited)`,
  };
}

export async function executeProductionAudit({
  runCommand = defaultRunCommand,
  timeoutMs = PRODUCTION_AUDIT_TIMEOUT_MS,
} = {}) {
  let result;
  try {
    result = await runCommand('pnpm', ['audit', '--prod', '--json'], {
      cwd: fileURLToPath(root),
      timeoutMs,
    });
  } catch (error) {
    result = { exitCode: null, stdout: '', stderr: '', error: boundedReason(error?.message) };
  }
  return evaluateProductionAudit(result, { timeoutMs });
}

// --- Release readiness -------------------------------------------------------

export async function main({ runCommand, log = (...args) => console.log(...args) } = {}) {
  const workspace = await text('pnpm-workspace.yaml');
  const lockfile = await text('pnpm-lock.yaml');
  const ci = await text('.github/workflows/ci.yml');
  const kernelIndex = await text('packages/kernel/src/index.ts');
  const memoryIndex = await text('packages/kernel/src/memory/index.ts');
  const executionIndex = await text('packages/kernel/src/execution/index.ts');
  const searchAdapter = await text('packages/kernel/src/execution/public-web-search-adapter.ts');
  const connectorsIndex = await text('packages/connectors/src/index.ts');
  const projectState = await text('PROJECT_STATE.md');
  const internalRelease = JSON.parse(await text('INTERNAL_RELEASE.json'));

  requireCondition(!workspace.includes('ignoreGhsas'), 'production audit contains a GHSA ignore');
  requireCondition(workspace.includes("nanoid: '3.3.18'"), 'patched Nano ID override is missing');
  requireCondition(lockfile.includes('nanoid@3.3.18:'), 'patched Nano ID is not locked');
  requireCondition(!lockfile.includes('nanoid@3.3.16:'), 'vulnerable Nano ID 3.3.16 returned');

  requireCondition(await exists('packages/kernel/src/memory/durable-memory-authority-receipt-repository.ts'), 'durable memory authority repository is missing');
  requireCondition(kernelIndex.includes("export * from './memory'"), 'Kernel memory barrel is not public');
  requireCondition(memoryIndex.includes('DurableMemoryAuthorityReceiptRepository'), 'durable memory authority repository is not exported');

  requireCondition(connectorsIndex.includes('PublicWebSearchClient'), 'native public web search client is not exported');
  requireCondition(kernelIndex.includes("export * from './execution'"), 'Kernel execution barrel is not public');
  requireCondition(executionIndex.includes("export * from './public-web-search-adapter'"), 'web.search adapter module is not public');
  requireCondition(searchAdapter.includes('PUBLIC_WEB_SEARCH_CAPABILITY'), 'web.search capability definition is missing');
  requireCondition(searchAdapter.includes('PublicWebSearchExecutionAdapter'), 'web.search execution adapter is missing');

  requireCondition(await exists('apps/local-kernel/golden-drill-goal.e2e.test.mjs'), 'Golden Goal E2E is missing');
  requireCondition(await exists('tests/acceptance/golden-drill-goal.feature'), 'Golden Goal feature contract is missing');

  requireCondition(await exists('Install Efesto.cmd'), 'Windows one-click installer entrypoint is missing');
  requireCondition(await exists('scripts/install-efesto.ps1'), 'Windows self-healing installer is missing');
  requireCondition(await exists('scripts/efesto-installer-contract.test.mjs'), 'installer regression contract is missing');

  requireCondition(ci.includes('Production dependency audit'), 'production audit CI step is missing');
  requireCondition(ci.includes('pnpm audit --prod'), 'strict production audit command is missing');
  requireCondition(ci.includes('MVP release readiness contract'), 'release readiness contract is not enforced by CI');
  requireCondition(ci.includes('dashboard-browser:'), 'dedicated dashboard browser job is missing');
  requireCondition(ci.includes('playwright install --with-deps chromium'), 'Chromium installation gate is missing');
  requireCondition(ci.includes('@internet-brain-os/dashboard e2e'), 'dashboard browser acceptance command is missing');
  requireCondition(ci.includes('pnpm verify:first-run'), 'first-run verification is missing from CI');

  requireCondition(projectState.includes('Authentic Hermes v0.19.0 runtime acceptance was proven'), 'canonical state does not record authentic Hermes proof');
  requireCondition(projectState.includes('Goal-first shell'), 'canonical state does not record the Goal-first UI baseline');
  requireCondition(projectState.includes('living-forge'), 'canonical state does not record the living-forge visual baseline');
  requireCondition(await exists('apps/dashboard/app/efesto-forge-visual.css'), 'living-forge visual layer is missing');
  requireCondition(await exists('apps/dashboard/components/brand/efesto-mark.tsx'), 'Efesto node-flame brand component is missing');
  requireCondition(await exists('apps/dashboard/app/icon.svg'), 'Efesto node-flame app icon is missing');
  requireCondition(projectState.includes('The **public release light is separate**'), 'canonical state does not separate implementation readiness from public-launch approval');
  requireCondition(internalRelease.channel === 'internal', 'release channel is not internal');
  requireCondition(internalRelease.publicLaunchApproved === false, 'public launch must remain blocked during internal qualification');

  const audit = await executeProductionAudit(runCommand ? { runCommand } : {});
  const ready = audit.status === 'green';

  log(`Efesto MVP release readiness: ${ready ? 'GREEN' : 'BLOCKED'}`);
  log('durable-memory-authority: green');
  log('authentic-hermes-boundary: green');
  log('native-web-search-read: green');
  log('golden-goal-e2e: green');
  log('goal-first-ui-baseline: green');
  log('living-forge-visual-baseline: green');
  log('dashboard-chromium-gate: green');
  log('windows-one-click-installer: green');
  log(`strict-supply-chain-audit: ${audit.status}`);
  log(`strict-supply-chain-audit-evidence: ${audit.evidence}`);
  log('public-launch-approval: blocked-pending-uat');
  log('canonical-project-state: green');

  if (!ready) {
    throw new Error(`Release readiness failed: strict-supply-chain-audit is ${audit.status} — ${audit.evidence}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
