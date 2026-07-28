import { randomUUID } from 'node:crypto';

export class ChatServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ChatServiceError';
    this.code = code;
    this.status = status;
  }
}

export class KernelChatService {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async complete(input) {
    const provider = await this.registry.get(input?.providerId);
    const model = clean(input?.model, 120);
    if (!provider.models.includes(model)) throw new ChatServiceError('MODEL_NOT_ALLOWED', 'The selected model is not configured for this provider.');
    const messages = validateMessages(input?.messages);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = provider.type === 'ollama'
        ? await this.#ollama(provider, model, messages, controller.signal)
        : await this.#openAiCompatible(provider, model, messages, controller.signal);
      return {
        id: `chat-${randomUUID()}`,
        providerId: provider.id,
        model: response.model || model,
        content: response.content,
        usage: response.usage,
        createdAt: new Date().toISOString(),
        evidenceStatus: 'unverified_model_output',
        memoryStatus: 'not_admitted',
      };
    } catch (error) {
      if (error instanceof ChatServiceError) throw error;
      if (controller.signal.aborted) throw new ChatServiceError('CHAT_TIMEOUT', 'The model request timed out.', 504);
      throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'The model provider request failed.', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  async #ollama(provider, model, messages, signal) {
    const response = await this.fetchImpl(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({ model, stream: false, messages }),
    });
    if (!response.ok) throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'Ollama request failed.', 502);
    const body = await response.json();
    if (typeof body?.message?.content !== 'string' || !body.message.content.trim()) throw invalidResponse();
    return {
      content: body.message.content,
      model: typeof body.model === 'string' ? body.model : model,
      usage: usage(body.prompt_eval_count, body.eval_count),
    };
  }

  async #openAiCompatible(provider, model, messages, signal) {
    const response = await this.fetchImpl(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
      signal,
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!response.ok) throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'Remote model provider request failed.', response.status === 401 ? 502 : 502);
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw invalidResponse();
    return {
      content,
      model: typeof body.model === 'string' ? body.model : model,
      usage: validUsage(body.usage),
    };
  }
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new ChatServiceError('INVALID_CHAT_INPUT', 'Chat messages are required.');
  let total = 0;
  const messages = value.map((message) => {
    const role = message?.role;
    if (typeof message?.content !== 'string' || message.content.length > 20_000) throw new ChatServiceError('INVALID_CHAT_INPUT', 'Chat message is invalid.');
    const content = clean(message.content, 20_000);
    if (!['system', 'user', 'assistant'].includes(role) || !content) throw new ChatServiceError('INVALID_CHAT_INPUT', 'Chat message is invalid.');
    total += content.length;
    return { role, content };
  });
  if (total > 60_000) throw new ChatServiceError('INVALID_CHAT_INPUT', 'Chat context is too large.', 413);
  return messages;
}
function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function invalidResponse() { return new ChatServiceError('CHAT_INVALID_RESPONSE', 'The model returned an invalid response.', 502); }
function usage(prompt, completion) {
  return Number.isInteger(prompt) && Number.isInteger(completion)
    ? { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion }
    : undefined;
}
function validUsage(value) {
  return value && Number.isInteger(value.prompt_tokens) && Number.isInteger(value.completion_tokens)
    ? { promptTokens: value.prompt_tokens, completionTokens: value.completion_tokens, totalTokens: value.total_tokens }
    : undefined;
}
