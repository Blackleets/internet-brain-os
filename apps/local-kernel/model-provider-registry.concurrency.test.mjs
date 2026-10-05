import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModelProviderRegistry } from './model-provider-registry.mjs';

// save/remove were unserialized whole-file read → modify → write: two provider saves at
// once (e.g. adding Ollama and a remote provider from Settings) kept only one of them.
let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function registry() {
  dir = await mkdtemp(join(tmpdir(), 'efesto-providers-'));
  return new ModelProviderRegistry(join(dir, 'model-providers.json'));
}

const ollama = (id) => ({ id, type: 'ollama', label: `Local ${id}`, baseUrl: 'http://127.0.0.1:11434', models: ['qwen3:4b'] });

describe('ModelProviderRegistry concurrent writes', () => {
  it('keeps every provider saved concurrently', async () => {
    const providers = await registry();
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => providers.save(ollama(`provider-${id}`))));
    expect((await providers.list()).map((item) => item.id).sort()).toEqual(['provider-a', 'provider-b', 'provider-c', 'provider-d']);
  });

  it('a remove racing a save does not resurrect or drop the wrong provider', async () => {
    const providers = await registry();
    await providers.save(ollama('provider-old'));
    await Promise.all([providers.remove('provider-old'), providers.save(ollama('provider-new'))]);
    expect((await providers.list()).map((item) => item.id)).toEqual(['provider-new']);
  });

  it('a failed mutation does not block later ones', async () => {
    const providers = await registry();
    await expect(providers.remove('provider-missing')).rejects.toThrow();
    await providers.save(ollama('provider-after'));
    expect((await providers.list()).map((item) => item.id)).toEqual(['provider-after']);
  });
});
