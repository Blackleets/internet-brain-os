import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager, matchOpportunityToGoals } from './goals.mjs';

describe('private Goals', () => {
  it('persists a bounded goal once in the local store', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-goals-'));
    const manager = new GoalManager(new LocalKnowledgeStore(join(dir, 'store.json')));
    const input = { title: 'Find remote AI work', categories: ['job'], keywords: ['remote', 'AI'], location: 'Madrid', priority: 3 };
    const first = await manager.create(input);
    const duplicate = await manager.create(input);
    expect(first).toEqual(expect.objectContaining({ id: expect.stringMatching(/^goal:/), status: 'active', priority: 3 }));
    expect(duplicate.id).toBe(first.id);
    await expect(manager.list()).resolves.toHaveLength(1);
  });

  it('rejects goals without a discovery signal or with unsupported categories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-goals-invalid-'));
    const manager = new GoalManager(new LocalKnowledgeStore(join(dir, 'store.json')));
    await expect(manager.create({ title: 'Anything please' })).rejects.toMatchObject({ code: 'INVALID_GOAL' });
    await expect(manager.create({ title: 'Secret action', categories: ['wallet'] })).rejects.toMatchObject({ code: 'INVALID_GOAL' });
  });

  it('explains why an opportunity advances a goal', () => {
    const matches = matchOpportunityToGoals({ category: 'job', categoryLabel: 'Job', title: 'Remote AI engineer in Madrid', reasons: ['remote'], sourceHost: 'example.com' }, [{ id: 'goal:1', title: 'Find remote AI work', categories: ['job'], keywords: ['remote', 'AI'], location: 'Madrid', priority: 3, status: 'active' }]);
    expect(matches[0]).toEqual(expect.objectContaining({ goalId: 'goal:1', score: 86, reasons: expect.arrayContaining(['Matches Job', 'Location: Madrid']) }));
  });
});
