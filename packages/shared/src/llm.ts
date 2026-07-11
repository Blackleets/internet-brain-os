// llm.ts
import type { RequestId, IsoDateTime } from './common';

export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCallId?: string;
}

export interface LLMRequest {
  readonly requestId: RequestId;
  readonly model?: string;
  readonly messages: readonly LLMMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly stop?: readonly string[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface LLMResponse {
  readonly requestId: RequestId;
  readonly content: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly timestamp: IsoDateTime;
}