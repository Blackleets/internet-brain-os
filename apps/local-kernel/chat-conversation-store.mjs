import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES = 100;

export class ChatConversationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ChatConversationError';
    this.code = code;
    this.status = status;
  }
}

export class ChatConversationStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.now = options.now ?? (() => new Date());
  }

  async list() {
    const state = await this.#read();
    return [...state.conversations]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(summary);
  }

  async get(id) {
    const conversation = (await this.#read()).conversations.find((item) => item.id === id);
    if (!conversation) throw notFound();
    return structuredClone(conversation);
  }

  async create(input) {
    const providerId = clean(input?.providerId, 64);
    const model = clean(input?.model, 120);
    const caseId = clean(input?.caseId, 160);
    if (!providerId || !model) throw invalid();
    const timestamp = this.now().toISOString();
    const conversation = {
      id: `conversation-${randomUUID()}`,
      title: clean(input?.title, 120) || 'Nueva conversación',
      providerId,
      model,
      ...(caseId ? { caseId } : {}),
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      evidenceStatus: 'unverified_model_output',
      memoryStatus: 'not_admitted',
    };
    const state = await this.#read();
    state.conversations.unshift(conversation);
    state.conversations = state.conversations.slice(0, MAX_CONVERSATIONS);
    await this.#write(state);
    return structuredClone(conversation);
  }

  async appendExchange(id, input) {
    const state = await this.#read();
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation) throw notFound();
    const user = clean(input?.user, 20_000);
    const assistant = clean(input?.assistant, 20_000);
    if (!user || !assistant) throw invalid();
    const timestamp = this.now().toISOString();
    conversation.messages.push(
      { id: `message-${randomUUID()}`, role: 'user', content: user, createdAt: timestamp },
      {
        id: `message-${randomUUID()}`,
        role: 'assistant',
        content: assistant,
        model: clean(input?.model, 120) || conversation.model,
        createdAt: timestamp,
        evidenceStatus: 'unverified_model_output',
        memoryStatus: 'not_admitted',
      },
    );
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
    conversation.title = conversation.title === 'Nueva conversación' ? user.slice(0, 80) : conversation.title;
    conversation.providerId = clean(input?.providerId, 64) || conversation.providerId;
    conversation.model = clean(input?.model, 120) || conversation.model;
    conversation.updatedAt = timestamp;
    await this.#write(state);
    return structuredClone(conversation);
  }

  async remove(id) {
    const state = await this.#read();
    const next = state.conversations.filter((item) => item.id !== id);
    if (next.length === state.conversations.length) throw notFound();
    state.conversations = next;
    await this.#write(state);
  }

  async #read() {
    try {
      const state = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (state?.version !== 1 || !Array.isArray(state.conversations)) throw new Error('invalid chat conversation store');
      return state;
    } catch (error) {
      if (error?.code === 'ENOENT') return { version: 1, conversations: [] };
      throw error;
    }
  }

  async #write(state) {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await chmod(temporary, 0o600);
    await rename(temporary, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}

function summary(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    providerId: conversation.providerId,
    model: conversation.model,
    ...(conversation.caseId ? { caseId: conversation.caseId } : {}),
    messageCount: conversation.messages.length,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    evidenceStatus: conversation.evidenceStatus,
    memoryStatus: conversation.memoryStatus,
  };
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}
function invalid() { return new ChatConversationError('INVALID_CONVERSATION', 'Conversation input is invalid.'); }
function notFound() { return new ChatConversationError('CONVERSATION_NOT_FOUND', 'Conversation was not found.', 404); }
