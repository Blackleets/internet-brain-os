import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimePath = resolve(repositoryRoot, 'packages/kernel/dist/index.js');

try {
  await access(runtimePath);
  const kernel = await import(pathToFileURL(runtimePath).href);
  const publicWebRuntimePath = resolve(repositoryRoot, 'packages/kernel/dist/execution/public-web-search-adapter.js');
  await access(publicWebRuntimePath);
  const publicWeb = await import(pathToFileURL(publicWebRuntimePath).href);
  const publicWebCapability = publicWeb.PUBLIC_WEB_SEARCH_CAPABILITY ?? publicWeb.default?.PUBLIC_WEB_SEARCH_CAPABILITY;
  const required = [
    ['CapabilityRegistry', typeof kernel.CapabilityRegistry === 'function'],
    ['PUBLIC_WEB_SEARCH_CAPABILITY', typeof publicWebCapability === 'object' && publicWebCapability?.id === 'web.search'],
    ['evaluateAutomaticReadOnlyContinuation', typeof kernel.evaluateAutomaticReadOnlyContinuation === 'function'],
    ['AUTOMATIC_READ_ONLY_POLICY_VERSION', typeof kernel.AUTOMATIC_READ_ONLY_POLICY_VERSION === 'string'],
  ];
  const missing = required.filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) throw new Error(`missing exports: ${missing.join(', ')}`);
  process.stdout.write(JSON.stringify({ ok: true, runtime: 'packages/kernel/dist/index.js' }) + '\n');
} catch (error) {
  const message = String(error?.message ?? error).replace(/[\r\n]+/g, ' ').slice(0, 240);
  process.stderr.write(JSON.stringify({ ok: false, code: 'TRUSTED_KERNEL_RUNTIME_INVALID', message }) + '\n');
  process.exitCode = 1;
}