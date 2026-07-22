import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { PreferenceLearner, preferenceAdjustment } from './preference-learner.mjs';

describe('private preference learner', () => {
  it('learns bounded explainable preferences from explicit feedback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:abc', category: 'food', benefitType: 'savings', sourceHost: 'local.example' }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:abc', { signal: 'saved' });
    const duplicate = await learner.record('opportunity:abc', { signal: 'saved' });
    const profile = await learner.profile();
    expect(duplicate.signal).toBe('saved');
    expect(profile).toMatchObject({ eventCount: 1, categories: { food: 10 }, benefitTypes: { savings: 4 }, sources: { 'local.example': 2 } });
    expect(preferenceAdjustment({ category: 'food', benefitType: 'savings', sourceHost: 'local.example' }, profile)).toBe(16);
  });

  it('allows the user to erase learned preferences', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-reset-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:def', category: 'money', benefitType: 'income', sourceHost: 'spam.example' }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:def', { signal: 'not_interested' });
    const profile = await learner.profile();
    expect(preferenceAdjustment({ category: 'money', benefitType: 'income', sourceHost: 'spam.example' }, profile)).toBeLessThan(0);
    await learner.reset();
    expect(await learner.profile()).toEqual({ categories: {}, benefitTypes: {}, sources: {}, eventCount: 0 });
  });

  it('atomically removes explicitly dismissed opportunities from the Inbox', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-dismiss-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:gone', status: 'new', category: 'job', benefitType: 'income', sourceHost: 'jobs.example' }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:gone', { signal: 'dismissed' });
    const data = await store.read();
    expect(data.opportunities[0].status).toBe('dismissed');
    expect(data.preferenceFeedback).toHaveLength(1);
  });
});
