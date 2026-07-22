import { access, constants, stat } from 'node:fs/promises';
import { delimiter, isAbsolute, resolve } from 'node:path';

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

async function resolveExecutable(command) {
  const candidates = isAbsolute(command) || command.includes('/') || command.includes('\\')
    ? [resolve(command)]
    : (process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));
  if (process.platform === 'win32' && !/\.[a-z0-9]+$/i.test(command)) {
    const extensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';');
    candidates.push(...candidates.flatMap((candidate) => extensions.map((extension) => `${candidate}${extension.toLowerCase()}`)));
  }
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch { /* try next PATH entry */ }
  }
  return undefined;
}

async function main() {
  const kernelUrl = process.env.HEPHAESTUS_KERNEL_URL ?? 'http://127.0.0.1:4000';
  try { pass('Kernel URL', validateLoopback(kernelUrl)); }
  catch (error) { fail('Kernel URL', error.message); }

  const token = process.env.HEPHAESTUS_API_TOKEN;
  if (typeof token === 'string' && token.trim() && !/[\u0000-\u0020\u007f]/.test(token)) pass('API token', 'configured (value hidden)');
  else fail('API token', 'set HEPHAESTUS_API_TOKEN to the private local Kernel token');

  const command = process.env.HEPHAESTUS_HERMES_COMMAND;
  if (!command?.trim()) fail('Hermes adapter command', 'set HEPHAESTUS_HERMES_COMMAND');
  else {
    const executable = await resolveExecutable(command.trim());
    executable ? pass('Hermes adapter command', `executable found: ${executable}`) : fail('Hermes adapter command', 'command was not found or is not executable');
  }

  try {
    const args = parseArgs(process.env.HEPHAESTUS_HERMES_ARGS_JSON);
    pass('Hermes adapter arguments', `${args.length} configured argument(s); values hidden`);
  } catch (error) { fail('Hermes adapter arguments', error.message); }

  const kernelCheck = checks.find((check) => check.name === 'Kernel URL' && check.ok);
  if (kernelCheck && token) {
    try {
      const response = await fetch(`${kernelCheck.detail}/status`, {
        headers: { 'x-hephaestus-token': token }, signal: AbortSignal.timeout(3000),
      });
      if (response.ok) pass('Kernel reachability', `HTTP ${response.status}`);
      else fail('Kernel reachability', `HTTP ${response.status}`);
    } catch { fail('Kernel reachability', 'Kernel is not reachable; start it with pnpm kernel:serve'); }
  } else fail('Kernel reachability', 'skipped until URL and token are valid');

  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}: ${check.detail}`);
  const failed = checks.filter((check) => !check.ok).length;
  console.log(`\n${failed === 0 ? 'READY' : 'NOT READY'}: ${checks.length - failed}/${checks.length} checks passed.`);
  if (failed > 0) process.exitCode = 1;
}

await main();
