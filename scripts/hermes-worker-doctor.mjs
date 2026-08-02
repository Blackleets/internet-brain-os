import { resolve } from 'node:path';
import { loadExistingApiToken } from '../apps/local-kernel/api-token-store.mjs';
import { detectHermesRuntime, resolveExecutable } from '../apps/local-kernel/hermes-runtime.mjs';

const checks = [];

function pass(name, detail) { checks.push({ name, ok: true, detail }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); }

function parseArgs(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error();
    return parsed;
  } catch {
    throw new Error('HEPHAESTUS_HERMES_ARGS_JSON must be a JSON array of strings');
  }
}

function validateLoopback(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('must be loopback HTTP');
  }
  return url.href.replace(/\/$/, '');
}

async function resolveToken() {
  const environmentToken = process.env.HEPHAESTUS_API_TOKEN;
  if (environmentToken !== undefined) {
    if (environmentToken.trim() && !/[\u0000-\u0020\u007f]/.test(environmentToken)) return environmentToken;
    return undefined;
  }
  const dataDir = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus');
  try {
    return (await loadExistingApiToken(resolve(dataDir, 'kernel-api-token'))).token;
  } catch {
    return undefined;
  }
}

async function checkHermesAdapter() {
  const legacyCommand = process.env.HEPHAESTUS_HERMES_COMMAND?.trim();
  if (legacyCommand) {
    const executable = await resolveExecutable(legacyCommand);
    executable
      ? pass('Hermes adapter', 'legacy adapter executable found (path hidden)')
      : fail('Hermes adapter', 'legacy adapter command was not found or is not executable');
    try {
      const args = parseArgs(process.env.HEPHAESTUS_HERMES_ARGS_JSON);
      pass('Hermes adapter arguments', `${args.length} configured argument(s); values hidden`);
    } catch (error) {
      fail('Hermes adapter arguments', error.message);
    }
    return;
  }

  const runtime = await detectHermesRuntime();
  runtime.available
    ? pass('Hermes adapter', 'bundled adapter and Hermes runtime detected (path hidden)')
    : fail('Hermes adapter', 'install Hermes or set HEPHAESTUS_HERMES_EXECUTABLE');
  pass('Hermes adapter arguments', 'bundled adapter selected; no manual arguments required');
}

async function main() {
  const kernelUrl = process.env.HEPHAESTUS_KERNEL_URL ?? 'http://127.0.0.1:4000';
  try { pass('Kernel URL', validateLoopback(kernelUrl)); }
  catch (error) { fail('Kernel URL', error.message); }

  const token = await resolveToken();
  token
    ? pass('API token', 'configured (value and path hidden)')
    : fail('API token', 'start the Kernel once or set HEPHAESTUS_API_TOKEN');

  await checkHermesAdapter();

  const kernelCheck = checks.find((check) => check.name === 'Kernel URL' && check.ok);
  if (kernelCheck && token) {
    try {
      const response = await fetch(`${kernelCheck.detail}/status`, {
        headers: { 'x-hephaestus-token': token },
        signal: AbortSignal.timeout(3000),
      });
      response.ok
        ? pass('Kernel reachability', `HTTP ${response.status}`)
        : fail('Kernel reachability', `HTTP ${response.status}`);
    } catch {
      fail('Kernel reachability', 'Kernel is not reachable; start it with pnpm kernel:serve');
    }
  } else {
    fail('Kernel reachability', 'skipped until URL and token are valid');
  }

  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
  const failed = checks.filter((check) => !check.ok).length;
  console.log(`\n${failed === 0 ? 'READY' : 'NOT READY'}: ${checks.length - failed}/${checks.length} checks passed.`);
  if (failed > 0) process.exitCode = 1;
}

await main();
