import { describe, expect, it, vi } from 'vitest';
import { KernelChatService } from './chat-service.mjs';

const provider = {
  id: 'openai-user',
  type: 'openai-compatible',
  label: 'OpenAI',
  baseUrl: 'https://api.openai.com',
  models: ['gpt-model'],
  apiKey: 'private-test-key',
};

describe('KernelChatService', () => {
  it('routes a bounded conversation without granting Evidence or memory authority', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer private-test-key');
      return Response.json({
        model: 'gpt-model',
        choices: [{ message: { content: 'Respuesta local segura.' } }],
        usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
      });
    });
    const service = new KernelChatService({ get: vi.fn(async () => provider) }, { fetchImpl });
    await expect(service.complete({
      providerId: 'openai-user',
      model: 'gpt-model',
      messages: [{ role: 'user', content: 'Hola' }],
    })).resolves.toMatchObject({
      content: 'Respuesta local segura.',
      evidenceStatus: 'unverified_model_output',
      memoryStatus: 'not_admitted',
    });
  });

  it('rejects unconfigured models and oversized chat context before transport', async () => {
    const fetchImpl = vi.fn();
    const service = new KernelChatService({ get: vi.fn(async () => provider) }, { fetchImpl });
    await expect(service.complete({
      providerId: 'openai-user',
      model: 'unknown',
      messages: [{ role: 'user', content: 'Hola' }],
    })).rejects.toMatchObject({ code: 'MODEL_NOT_ALLOWED' });
    await expect(service.complete({
      providerId: 'openai-user',
      model: 'gpt-model',
      messages: [{ role: 'user', content: 'x'.repeat(70_000) }],
    })).rejects.toMatchObject({ code: 'INVALID_CHAT_INPUT' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
