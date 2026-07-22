import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach } from 'vitest';
import { createLocalKernelServer } from './server.mjs';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';

let server;
afterEach(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

async function listenWith(options) {
  server = createLocalKernelServer({}, undefined, undefined, undefined, options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function status(baseUrl) {
  const response = await fetch(`${baseUrl}/bootstrap/status`);
  expect(response.status).toBe(200);
  return response.json();
}

describe('GET /bootstrap/status real probe contract', () => {
  it('reports Hermes missing from shared probes instead of static server values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-bootstrap-'));
    const baseUrl = await listenWith({
      apiToken: 'test-token-that-is-at-least-32-characters',
      bootstrapProbeOptions: { cwd: dir, env: { PATH: '', HEPHAESTUS_DATA_DIR: dir }, validateHermes: false },
    });
    await expect(status(baseUrl)).resolves.toMatchObject({ hermes: 'missing', overall: 'needs_setup' });
  });

  it('reports Hermes invalid when validation fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-bootstrap-'));
    const hermesPath = join(dir, 'hermes.exe');
    await writeFile(hermesPath, 'not executable', 'utf8');
    const baseUrl = await listenWith({
      apiToken: 'test-token-that-is-at-least-32-characters',
      bootstrapProbeOptions: {
        cwd: dir,
        env: { HEPHAESTUS_DATA_DIR: dir, HEPHAESTUS_HERMES_EXECUTABLE: hermesPath, EFESTO_VALIDATE_HERMES: '1' },
        runHermesValidation: async () => ({ code: 1 }),
      },
    });
    await expect(status(baseUrl)).resolves.toMatchObject({ hermes: 'invalid', overall: 'needs_setup' });
  });

  it('reports an unwritable Obsidian vault through the shared probe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-bootstrap-'));
    const vault = join(dir, 'vault');
    const baseUrl = await listenWith({
      apiToken: 'test-token-that-is-at-least-32-characters',
      bootstrapProbeOptions: {
        cwd: dir,
        env: { PATH: '', HEPHAESTUS_DATA_DIR: dir, HEPHAESTUS_OBSIDIAN_DIR: vault },
        writeObsidianProbe: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); },
      },
    });
    await expect(status(baseUrl)).resolves.toMatchObject({ obsidian: 'unwritable', overall: 'needs_setup' });
  });

  it('reports pairing required before extension pairing completes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-bootstrap-'));
    await writeFile(join(dir, 'kernel-api-token'), `${'a'.repeat(64)}\n`, 'utf8');
    const baseUrl = await listenWith({
      apiToken: 'test-token-that-is-at-least-32-characters',
      bootstrapProbeOptions: { cwd: dir, env: { PATH: '', HEPHAESTUS_DATA_DIR: dir } },
    });
    await expect(status(baseUrl)).resolves.toMatchObject({ pairing: 'required' });
  });

  it('reports paired after the extension identity registry contains an authorized extension', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-bootstrap-'));
    await writeFile(join(dir, 'kernel-api-token'), `${'a'.repeat(64)}\n`, 'utf8');
    const registry = new ExtensionIdentityRegistry(join(dir, 'authorized-extensions.json'));
    await registry.authorize(`chrome-extension://${'a'.repeat(32)}`);
    const baseUrl = await listenWith({
      apiToken: 'test-token-that-is-at-least-32-characters',
      bootstrapProbeOptions: { cwd: dir, env: { PATH: '', HEPHAESTUS_DATA_DIR: dir } },
    });
    await expect(status(baseUrl)).resolves.toMatchObject({ pairing: 'paired' });
  });
});
