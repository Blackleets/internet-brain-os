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

  it('enriches the one-line drill Goal with offer/tool intent and numeric price bounds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-goals-drill-'));
    const manager = new GoalManager(new LocalKnowledgeStore(join(dir, 'store.json')));
    const goal = await manager.create({
      title: 'Find a good-quality drill in Spain for €18–€25 from reputable sellers.',
      keywords: ['find', 'good', 'quality', 'drill', 'spain', 'from', 'reputable', 'sellers'],
      priority: 2,
    });
    expect(goal.categories).toEqual(expect.arrayContaining(['offer', 'tool']));
    expect(goal.keywords).toEqual(expect.arrayContaining(['drill', 'spain', '18', '25']));

    const matches = matchOpportunityToGoals({
      category: 'tool', categoryLabel: 'Tool', title: 'Cordless drill Spain €22', reasons: ['drill', 'reputable seller'], sourceHost: 'shop.example',
    }, [goal]);
    expect(matches[0]).toMatchObject({ goalId: goal.id, score: expect.any(Number) });
    expect(matches[0].score).toBeGreaterThanOrEqual(25);
  });

  it('enriches the one-line freelance Goal without requiring category controls in the UI', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-goals-freelance-'));
    const manager = new GoalManager(new LocalKnowledgeStore(join(dir, 'store.json')));
    const goal = await manager.create({
      title: 'Find recent remote freelance work matching my skills at $20–$30/hour or more.',
      keywords: ['recent', 'remote', 'freelance', 'work', 'matching', 'skills', 'hour', 'more'],
      priority: 2,
    });
    expect(goal.categories).toEqual(expect.arrayContaining(['job', 'client']));
    expect(goal.keywords).toEqual(expect.arrayContaining(['20', '30']));
  });

  it('preserves explicit supported categories instead of letting inference override user intent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-goals-explicit-intent-'));
    const manager = new GoalManager(new LocalKnowledgeStore(join(dir, 'store.json')));
    const goal = await manager.create({ title: 'Find a free AI course under $20', categories: ['learning'], keywords: ['AI'], priority: 2 });
    expect(goal.categories).toEqual(['learning']);
    expect(goal.keywords).toEqual(expect.arrayContaining(['AI', '20']));
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
