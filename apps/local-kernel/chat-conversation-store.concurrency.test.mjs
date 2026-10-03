import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatConversationStore } from './chat-conversation-store.mjs';

// Every mutation was an unserialized read → modify → write of the whole file, so two
// concurrent chat operations (two tabs, or one stream's create racing another's
// appendExchange) overwrote each other: conversations and exchanges silently vanished.
let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function store() {
  dir = await mkdtemp(join(tmpdir(), 'efesto-chat-'));
  return new ChatConversationStore(join(dir, 'chat-conversations.json'));
}

describe('ChatConversationStore concurrent writes', () => {
  it('keeps every conversation created concurrently', async () => {
    const conversations = await store();
    await Promise.all(Array.from({ length: 5 }, (_, i) => conversations.create({ providerId: 'p', model: 'm', title: `t${i}` })));
    expect((await conversations.list()).length).toBe(5);
  });

  it('does not lose an exchange appended while another conversation is created', async () => {
    const conversations = await store();
    const first = await conversations.create({ providerId: 'p', model: 'm' });
    await Promise.all([
      conversations.appendExchange(first.id, { user: 'hola', assistant: 'buenas' }),
      conversations.create({ providerId: 'p', model: 'm', title: 'second' }),
    ]);
    expect((await conversations.get(first.id)).messages.length).toBe(2);
    expect((await conversations.list()).length).toBe(2);
  });

  it('a failed mutation does not block later ones', async () => {
    const conversations = await store();
    await expect(conversations.appendExchange('conversation-missing', { user: 'a', assistant: 'b' })).rejects.toThrow();
    await conversations.create({ providerId: 'p', model: 'm' });
    expect((await conversations.list()).length).toBe(1);
  });
});
