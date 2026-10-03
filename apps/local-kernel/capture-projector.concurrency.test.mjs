import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';

// store.json holds Goals, Evidence, Cases and agent missions. Writes were already
// queue-serialized, but used a fixed `.tmp` without wx and created the data directory
// with the process umask (typically 0o755). Chat/provider stores already use unique
// tmp + owner-private dirs; the knowledge store must match that fail-closed bar.
let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function knowledgeStore() {
  dir = await mkdtemp(join(tmpdir(), 'efesto-knowledge-'));
  const nested = join(dir, 'private-data');
  return { store: new LocalKnowledgeStore(join(nested, 'store.json')), nested };
}

describe('LocalKnowledgeStore concurrent writes and private perms', () => {
  it('keeps every Goal projected concurrently', async () => {
    const { store } = await knowledgeStore();
    await Promise.all(Array.from({ length: 5 }, (_, i) => store.project(async (data) => ({
      changed: true,
      data: {
        ...data,
        goals: [...(data.goals ?? []), { id: `goal:${i}`, title: `Goal ${i}`, status: 'active' }],
      },
      result: i,
    }))));
    const data = await store.read();
    expect(data.goals.map((item) => item.id).sort()).toEqual([
      'goal:0', 'goal:1', 'goal:2', 'goal:3', 'goal:4',
    ]);
  });

  it('a failed project does not block later ones', async () => {
    const { store } = await knowledgeStore();
    await expect(store.project(async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
    await store.project(async (data) => ({
      changed: true,
      data: { ...data, goals: [{ id: 'goal:ok', status: 'active' }] },
      result: true,
    }));
    expect((await store.read()).goals.map((item) => item.id)).toEqual(['goal:ok']);
  });

  it('creates an owner-private data directory and store file (non-Windows)', async () => {
    if (process.platform === 'win32') return;
    const { store, nested } = await knowledgeStore();
    await store.write({ cases: [], evidence: [], goals: [], agentMissions: [], opportunities: [], preferenceFeedback: [] });
    expect((await stat(nested)).mode & 0o777).toBe(0o700);
    expect((await stat(join(nested, 'store.json'))).mode & 0o777).toBe(0o600);
    // Unique tmp names must not leave a fixed store.json.tmp sibling behind.
    const siblings = await readdir(nested);
    expect(siblings).toEqual(['store.json']);
  });
});
