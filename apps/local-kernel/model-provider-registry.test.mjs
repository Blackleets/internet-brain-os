import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { ModelProviderRegistry } from './model-provider-registry.mjs';

describe('ModelProviderRegistry', () => {
  it('stores credentials privately and never returns them from list', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ibos-providers-'));
    const file = join(dir, 'providers.json');
    const registry = new ModelProviderRegistry(file);
    await registry.save({
      id: 'openai-user',
      type: 'openai-compatible',
      label: 'My OpenAI',
      baseUrl: 'https://api.openai.com',
      models: ['gpt-model'],
      apiKey: 'private-test-key',
    });

    expect(await registry.list()).toEqual([expect.objectContaining({ id: 'openai-user', hasCredential: true })]);
    expect(JSON.stringify(await registry.list())).not.toContain('private-test-key');
    expect(await readFile(file, 'utf8')).toContain('private-test-key');
    if (process.platform !== 'win32') expect((await stat(file)).mode & 0o077).toBe(0);
  });

  it('rejects remote plaintext HTTP providers and permits loopback Ollama', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ibos-providers-'));
    const registry = new ModelProviderRegistry(join(dir, 'providers.json'));
    await expect(registry.save({
      id: 'unsafe',
      type: 'openai-compatible',
      label: 'Unsafe',
      baseUrl: 'http://models.example',
      models: ['model'],
      apiKey: 'private-test-key',
    })).rejects.toMatchObject({ code: 'INVALID_MODEL_PROVIDER' });
    await expect(registry.save({
      id: 'ollama',
      type: 'ollama',
      label: 'Local',
      baseUrl: 'http://127.0.0.1:11434',
      models: ['qwen3:4b'],
    })).resolves.toMatchObject({ hasCredential: true });
  });
});

