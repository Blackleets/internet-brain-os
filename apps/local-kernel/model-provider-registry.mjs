import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const TYPES = new Set(['ollama', 'openai-compatible']);

export class ModelProviderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ModelProviderError';
    this.code = code;
    this.status = status;
  }
}

export class ModelProviderRegistry {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.defaults = (options.defaults ?? []).map((item) => validateProvider(item, { credentialOptional: true }));
  }

  async list() {
    const persisted = await this.#read();
    return mergeProviders(this.defaults, persisted).map(publicProvider);
  }

  async get(id) {
    const provider = mergeProviders(this.defaults, await this.#read()).find((item) => item.id === id);
    if (!provider) throw new ModelProviderError('PROVIDER_NOT_FOUND', 'Model provider was not found.', 404);
    return provider;
  }

  async save(input) {
    const provider = validateProvider({ ...input, id: cleanId(input?.id) || `provider-${randomUUID()}` });
    const persisted = await this.#read();
    const index = persisted.findIndex((item) => item.id === provider.id);
    if (index >= 0) persisted[index] = provider;
    else persisted.push(provider);
    await this.#write(persisted);
    return publicProvider(provider);
  }

  async remove(id) {
    if (this.defaults.some((item) => item.id === id)) {
      throw new ModelProviderError('PROVIDER_MANAGED_BY_ENV', 'Environment-managed providers cannot be deleted here.', 409);
    }
    const persisted = await this.#read();
    const next = persisted.filter((item) => item.id !== id);
    if (next.length === persisted.length) throw new ModelProviderError('PROVIDER_NOT_FOUND', 'Model provider was not found.', 404);
    await this.#write(next);
  }

  async #read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('invalid provider store');
      return parsed.map((item) => validateProvider(item));
    } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async #write(providers) {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(providers, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await chmod(temporary, 0o600);
    await rename(temporary, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}

function validateProvider(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Provider must be an object.');
  const id = cleanId(input.id);
  const type = clean(input.type, 32);
  const label = clean(input.label, 80);
  const baseUrl = normalizeBaseUrl(input.baseUrl, type);
  const models = Array.isArray(input.models)
    ? [...new Set(input.models.map((value) => clean(value, 120)).filter(Boolean))].slice(0, 50)
    : [];
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!id || !TYPES.has(type) || !label || models.length === 0) throw invalid('Provider id, type, label, and at least one model are required.');
  if (type === 'openai-compatible' && !options.credentialOptional && !validCredential(apiKey)) {
    throw invalid('A valid private API credential is required.');
  }
  return { id, type, label, baseUrl, models, ...(apiKey ? { apiKey } : {}), managedBy: input.managedBy === 'environment' ? 'environment' : 'user' };
}

function normalizeBaseUrl(value, type) {
  let url;
  try { url = new URL(clean(value, 500)); } catch { throw invalid('Provider URL is invalid.'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (type === 'ollama' && (!loopback || url.protocol !== 'http:')) throw invalid('Ollama must use a loopback HTTP URL.');
  if (type === 'openai-compatible' && url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw invalid('Remote providers must use HTTPS.');
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

function publicProvider(provider) {
  return {
    id: provider.id,
    type: provider.type,
    label: provider.label,
    baseUrl: provider.baseUrl,
    models: provider.models,
    hasCredential: Boolean(provider.apiKey) || provider.type === 'ollama',
    managedBy: provider.managedBy,
  };
}

function mergeProviders(defaults, persisted) {
  const merged = new Map(defaults.map((item) => [item.id, item]));
  for (const item of persisted) if (!merged.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
}
function clean(value, max) { return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''; }
function cleanId(value) { const result = clean(value, 64).toLowerCase(); return /^[a-z0-9][a-z0-9._-]*$/.test(result) ? result : ''; }
function validCredential(value) { return value.length >= 8 && value.length <= 512 && !/[\s\u0000-\u001f\u007f]/.test(value); }
function invalid(message) { return new ModelProviderError('INVALID_MODEL_PROVIDER', message); }

