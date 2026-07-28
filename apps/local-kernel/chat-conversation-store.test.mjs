import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChatConversationStore } from './chat-conversation-store.mjs';

describe('ChatConversationStore', () => {
  it('persists bounded conversation history outside Evidence and memory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ibos-chat-history-'));
    const file = join(dir, 'conversations.json');
    const store = new ChatConversationStore(file, { now: () => new Date('2026-07-28T12:00:00.000Z') });
    const created = await store.create({ providerId: 'ollama-local', model: 'qwen3:4b', caseId: 'case-1' });
    const updated = await store.appendExchange(created.id, {
      providerId: 'ollama-local',
      model: 'qwen3:4b',
      user: 'Explica este caso',
      assistant: 'Respuesta local',
    });

    expect(updated).toMatchObject({
      title: 'Explica este caso',
      caseId: 'case-1',
      evidenceStatus: 'unverified_model_output',
      memoryStatus: 'not_admitted',
      messages: [
        { role: 'user', content: 'Explica este caso' },
        {
          role: 'assistant',
          content: 'Respuesta local',
          evidenceStatus: 'unverified_model_output',
          memoryStatus: 'not_admitted',
        },
      ],
    });
    expect(await store.list()).toEqual([expect.objectContaining({ id: created.id, messageCount: 2 })]);
    expect(JSON.parse(await readFile(file, 'utf8')).conversations).toHaveLength(1);
    if (process.platform !== 'win32') expect((await stat(file)).mode & 0o077).toBe(0);
  });

  it('deletes only the selected local conversation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ibos-chat-delete-'));
    const store = new ChatConversationStore(join(dir, 'conversations.json'));
    const first = await store.create({ providerId: 'ollama-local', model: 'qwen3:4b' });
    const second = await store.create({ providerId: 'ollama-local', model: 'qwen3:4b' });
    await store.remove(first.id);
    expect((await store.list()).map((item) => item.id)).toEqual([second.id]);
    await expect(store.get(first.id)).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
  });
});
