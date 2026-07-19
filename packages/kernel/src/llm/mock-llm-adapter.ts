import type { IsoDateTime, LLMRequest, LLMResponse } from '@internet-brain-os/shared';
import type { LLMAdapter } from './llm-adapter';

export interface MockLLMAdapterOptions {
  readonly model?: string;
  readonly content?: string | ((input: LLMRequest) => string);
  readonly now?: () => IsoDateTime;
}

export class MockLLMAdapter implements LLMAdapter {
  readonly name = 'mock';
  private readonly model: string;
  private readonly content: string | ((input: LLMRequest) => string);
  private readonly now: () => IsoDateTime;

  constructor(options: MockLLMAdapterOptions = {}) {
    this.model = options.model ?? 'mock-local';
    this.content = options.content ?? ((input) => input.messages[input.messages.length - 1]?.content ?? '');
    this.now = options.now ?? (() => new Date().toISOString() as IsoDateTime);
  }

  async complete(input: LLMRequest): Promise<LLMResponse> {
    return {
      requestId: input.requestId,
      content: typeof this.content === 'function' ? this.content(input) : this.content,
      model: input.model ?? this.model,
      timestamp: this.now(),
    };
  }
}
