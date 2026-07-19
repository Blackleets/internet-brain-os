export class LLMAdapterError extends Error {
  readonly cause?: unknown;

  constructor(message: string, readonly code: string, cause?: unknown) {
    super(message);
    this.name = 'LLMAdapterError';
    this.cause = cause;
  }
}

export class LLMTimeoutError extends LLMAdapterError {
  constructor(provider: string, timeoutMs: number, cause?: unknown) {
    super(`${provider} request timed out after ${timeoutMs}ms`, 'LLM_TIMEOUT', cause);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMTransportError extends LLMAdapterError {
  constructor(provider: string, cause?: unknown) {
    super(`${provider} request failed`, 'LLM_TRANSPORT', cause);
    this.name = 'LLMTransportError';
  }
}

export class LLMUnavailableError extends LLMAdapterError {
  constructor(provider: string, status?: number) {
    super(`${provider} is unavailable${status ? ` (HTTP ${status})` : ''}`, 'LLM_UNAVAILABLE');
    this.name = 'LLMUnavailableError';
  }
}

export class LLMInvalidResponseError extends LLMAdapterError {
  constructor(provider: string) {
    super(`${provider} returned an invalid response`, 'LLM_INVALID_RESPONSE');
    this.name = 'LLMInvalidResponseError';
  }
}
