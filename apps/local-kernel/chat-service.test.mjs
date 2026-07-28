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

  it('streams Ollama deltas and supports caller cancellation', async () => {
    const ollama = { ...provider, id: 'ollama-local', type: 'ollama', baseUrl: 'http://127.0.0.1:11434', models: ['qwen3:4b'] };
    const encoder = new TextEncoder();
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body)).toMatchObject({ model: 'qwen3:4b', stream: true });
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('{"model":"qwen3:4b","message":{"content":"Hola "},"done":false}\n'));
          controller.enqueue(encoder.encode('{"model":"qwen3:4b","message":{"content":"mundo"},"done":false}\n'));
          controller.enqueue(encoder.encode('{"model":"qwen3:4b","message":{"content":""},"done":true,"prompt_eval_count":2,"eval_count":3}\n'));
          controller.close();
        },
      }));
    });
    const deltas = [];
    const service = new KernelChatService({ get: vi.fn(async () => ollama) }, { fetchImpl });
    await expect(service.stream({
      providerId: 'ollama-local',
      model: 'qwen3:4b',
      messages: [{ role: 'user', content: 'Hola' }],
    }, { onDelta: (delta) => deltas.push(delta) })).resolves.toMatchObject({
      content: 'Hola mundo',
      usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
      evidenceStatus: 'unverified_model_output',
      memoryStatus: 'not_admitted',
    });
    expect(deltas).toEqual(['Hola ', 'mundo']);

    const abort = new AbortController();
    abort.abort();
    await expect(service.stream({
      providerId: 'ollama-local',
      model: 'qwen3:4b',
      messages: [{ role: 'user', content: 'Hola' }],
    }, { signal: abort.signal })).rejects.toMatchObject({ code: 'CHAT_CANCELLED' });
  });
});
