import { describe, expect, it, vi } from 'vitest';
import { ModelForge } from './model-forge.mjs';

describe('Model Forge', () => {
  it('reports absent Ollama honestly and recommends within local RAM', async () => {
    const forge = new ModelForge({ ramGiB: 8, cpuCores: 4, fetchImpl: vi.fn(async () => { throw new Error('offline'); }) });
    const status = await forge.inspect();
    expect(status.runtime).toBe('not_detected');
    expect(status.recommended).toBe('gemma3:4b');
    expect(status.setup).toEqual({ action: 'install_ollama', command: null, setting: null, restartRequired: true });
    expect(status.models.find((model) => model.id === 'qwen3:8b').compatible).toBe(false);
  });

  it('detects installed and active models without installing anything', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ models: [{ name: 'qwen3:4b' }] }) }));
    const status = await new ModelForge({ ramGiB: 12, cpuCores: 8, activeModel: 'qwen3:4b', fetchImpl }).inspect();
    expect(status.runtime).toBe('available');
    expect(status.activeModel).toBe('qwen3:4b');
    expect(status.models.find((model) => model.id === 'qwen3:4b')).toMatchObject({ installed: true, active: true, compatible: true });
    expect(status.setup.setting).toBe('HEPHAESTUS_OLLAMA_MODEL=qwen3:4b');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects remote model endpoints', () => {
    expect(() => new ModelForge({ baseUrl: 'https://models.example' })).toThrow(/loopback/);
  });
});
