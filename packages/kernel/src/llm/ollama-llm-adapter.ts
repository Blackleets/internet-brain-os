import type { IsoDateTime, LLMRequest, LLMResponse } from '@internet-brain-os/shared';
import type { LLMAdapter } from './llm-adapter';
import {
  LLMInvalidResponseError,
  LLMTimeoutError,
  LLMTransportError,
  LLMUnavailableError,
} from './llm-errors';

interface OllamaChatResponse {
  readonly model?: unknown;
  readonly message?: { readonly content?: unknown };
  readonly prompt_eval_count?: unknown;
  readonly eval_count?: unknown;
}

export interface OllamaLLMAdapterOptions {
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => IsoDateTime;
}

export class OllamaLLMAdapter implements LLMAdapter {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => IsoDateTime;

  constructor(options: OllamaLLMAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.model = options.model ?? 'qwen2.5:3b';
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString() as IsoDateTime);
  }

  async complete(input: LLMRequest): Promise<LLMResponse> {
    const model = input.model ?? this.model;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          messages: input.messages.map(({ role, content }) => ({ role, content })),
          options: {
            ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
            ...(input.maxOutputTokens === undefined ? {} : { num_predict: input.maxOutputTokens }),
            ...(input.stop === undefined ? {} : { stop: input.stop }),
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 503) {
          throw new LLMUnavailableError(this.name, response.status);
        }
        throw new LLMTransportError(this.name);
      }

      const payload = (await response.json()) as OllamaChatResponse;
      const content = payload.message?.content;
      const actualModel = payload.model;
      if (typeof content !== 'string' || !content.trim() || typeof actualModel !== 'string') {
        throw new LLMInvalidResponseError(this.name);
      }

      const promptTokens = asNonNegativeInteger(payload.prompt_eval_count);
      const completionTokens = asNonNegativeInteger(payload.eval_count);
      return {
        requestId: input.requestId,
        content,
        model: actualModel,
        timestamp: this.now(),
        ...(promptTokens === undefined || completionTokens === undefined
          ? {}
          : {
              usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              },
            }),
      };
    } catch (error) {
      if (error instanceof LLMInvalidResponseError || error instanceof LLMUnavailableError || error instanceof LLMTransportError) {
        throw error;
      }
      if (controller.signal.aborted) throw new LLMTimeoutError(this.name, this.timeoutMs, error);
      throw new LLMTransportError(this.name, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function asNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
