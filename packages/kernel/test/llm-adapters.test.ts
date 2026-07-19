import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, LLMRequest, RequestId } from '@internet-brain-os/shared';
import {
  LLMInvalidResponseError,
  LLMUnavailableError,
  MockLLMAdapter,
  OllamaLLMAdapter,
} from '../src/llm';

const timestamp = '2026-07-19T10:45:00.000Z' as IsoDateTime;
const request: LLMRequest = {
  requestId: 'request:test' as RequestId,
  messages: [{ role: 'user', content: 'Summarize the evidence.' }],
  temperature: 0.2,
  maxOutputTokens: 128,
  stop: ['END'],
};

describe('MockLLMAdapter', () => {
  it('preserves request identity and produces deterministic offline output', async () => {
    const adapter = new MockLLMAdapter({ content: 'Summary', model: 'mock-test', now: () => timestamp });
    await expect(adapter.complete(request)).resolves.toEqual({
      requestId: request.requestId,
      content: 'Summary',
      model: 'mock-test',
      timestamp,
    });
  });
});

describe('OllamaLLMAdapter', () => {
  it('maps the provider-neutral request and returns usage', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'qwen-local',
        stream: false,
        messages: [{ role: 'user', content: 'Summarize the evidence.' }],
        options: { temperature: 0.2, num_predict: 128, stop: ['END'] },
      });
      return new Response(JSON.stringify({
        model: 'qwen-local',
        message: { content: 'Local summary' },
        prompt_eval_count: 10,
        eval_count: 4,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const adapter = new OllamaLLMAdapter({ model: 'qwen-local', fetchImpl: fetchImpl as typeof fetch, now: () => timestamp });
    await expect(adapter.complete(request)).resolves.toEqual({
      requestId: request.requestId,
      content: 'Local summary',
      model: 'qwen-local',
      timestamp,
      usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
    });
  });

  it('rejects malformed empty responses', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ model: 'qwen', message: { content: '' } }), { status: 200 }));
    const adapter = new OllamaLLMAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LLMInvalidResponseError);
  });

  it('classifies unavailable local service responses without exposing prompts', async () => {
    const fetchImpl = vi.fn(async () => new Response('missing', { status: 404 }));
    const adapter = new OllamaLLMAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LLMUnavailableError);
  });
});
