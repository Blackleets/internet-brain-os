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

  async stream(input, options = {}) {
    const provider = await this.registry.get(input?.providerId);
    const model = clean(input?.model, 120);
    if (!provider.models.includes(model)) throw new ChatServiceError('MODEL_NOT_ALLOWED', 'The selected model is not configured for this provider.');
    const messages = validateMessages(input?.messages);
    const controller = new AbortController();
    const abortForCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abortForCaller, { once: true });
    if (options.signal?.aborted) abortForCaller();
    if (controller.signal.aborted) throw new ChatServiceError('CHAT_CANCELLED', 'The model request was cancelled.', 499);
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    let content = '';
    const emit = async (delta) => {
      if (!delta) return;
      content += delta;
      if (content.length > 20_000) throw new ChatServiceError('CHAT_RESPONSE_TOO_LARGE', 'The model response is too large.', 413);
      await options.onDelta?.(delta);
    };
    try {
      const response = provider.type === 'ollama'
        ? await this.#ollamaStream(provider, model, messages, controller.signal, emit)
        : await this.#openAiCompatibleStream(provider, model, messages, controller.signal, emit);
      if (!content.trim()) throw invalidResponse();
      return {
        id: `chat-${randomUUID()}`,
        providerId: provider.id,
        model: response.model || model,
        content,
        usage: response.usage,
        createdAt: new Date().toISOString(),
        evidenceStatus: 'unverified_model_output',
        memoryStatus: 'not_admitted',
      };
    } catch (error) {
      if (error instanceof ChatServiceError) throw error;
      if (options.signal?.aborted) throw new ChatServiceError('CHAT_CANCELLED', 'The model request was cancelled.', 499);
      if (controller.signal.aborted) throw new ChatServiceError('CHAT_TIMEOUT', 'The model request timed out.', 504);
      throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'The model provider request failed.', 502);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortForCaller);
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

  async #ollamaStream(provider, model, messages, signal, emit) {
    const response = await this.fetchImpl(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({ model, stream: true, messages }),
    });
    if (!response.ok || !response.body) throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'Ollama request failed.', 502);
    let final;
    await readLines(response.body, async (line) => {
      const event = parseJson(line);
      if (event.error) throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'Ollama stream failed.', 502);
      if (typeof event.message?.content === 'string') await emit(event.message.content);
      if (event.done === true) final = event;
    });
    return {
      model: typeof final?.model === 'string' ? final.model : model,
      usage: usage(final?.prompt_eval_count, final?.eval_count),
    };
  }

  async #openAiCompatibleStream(provider, model, messages, signal, emit) {
    const response = await this.fetchImpl(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
      signal,
      body: JSON.stringify({ model, messages, stream: true, stream_options: { include_usage: true } }),
    });
    if (!response.ok || !response.body) throw new ChatServiceError('CHAT_PROVIDER_FAILED', 'Remote model provider request failed.', 502);
    let responseModel = model;
    let responseUsage;
    await readLines(response.body, async (line) => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      const event = parseJson(data);
      if (typeof event.model === 'string') responseModel = event.model;
      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') await emit(delta);
      responseUsage = validUsage(event.usage) ?? responseUsage;
    });
    return { model: responseModel, usage: responseUsage };
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

async function readLines(body, visit) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) await visit(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) await visit(buffer.trim());
}
function parseJson(value) {
  try { return JSON.parse(value); } catch { throw invalidResponse(); }
}
