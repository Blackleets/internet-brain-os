export class LLMAdapterError extends Error {
  constructor(message: string, readonly code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LLMAdapterError';
  }
}

export class LLMTimeoutError extends LLMAdapterError {
  constructor(provider: string, timeoutMs: number, options?: ErrorOptions) {
    super(`${provider} request timed out after ${timeoutMs}ms`, 'LLM_TIMEOUT', options);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMTransportError extends LLMAdapterError {
  constructor(provider: string, options?: ErrorOptions) {
    super(`${provider} request failed`, 'LLM_TRANSPORT', options);
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
