import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { InboxError } from './page-context-inbox.mjs';
import { PreferenceLearner, preferenceAdjustment } from './preference-learner.mjs';

describe('private preference learner', () => {
  it('learns bounded explainable preferences from explicit feedback and exposes the local product scorecard', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:abc', category: 'food', benefitType: 'savings', sourceHost: 'local.example', supported: true }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:abc', { signal: 'saved' });
    const duplicate = await learner.record('opportunity:abc', { signal: 'saved' });
    const profile = await learner.profile();
    expect(duplicate.signal).toBe('saved');
    expect(profile).toMatchObject({
      eventCount: 1,
      categories: { food: 10 },
      benefitTypes: { savings: 4 },
      sources: { 'local.example': 2 },
      productScorecard: {
        schemaVersion: 'efesto.product-scorecard.v1',
        sourceOfTruth: 'local_kernel',
        privacy: { mode: 'local_only', externalTelemetry: false },
      },
    });
    expect(preferenceAdjustment({ category: 'food', benefitType: 'savings', sourceHost: 'local.example' }, profile)).toBe(16);
  });

  it('allows the user to erase learned preferences without erasing factual product history', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-reset-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:def', category: 'money', benefitType: 'income', sourceHost: 'spam.example', supported: true }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:def', { signal: 'not_interested' });
    const profile = await learner.profile();
    expect(preferenceAdjustment({ category: 'money', benefitType: 'income', sourceHost: 'spam.example' }, profile)).toBeLessThan(0);
    await learner.reset();
    const resetProfile = await learner.profile();
    expect(resetProfile).toMatchObject({ categories: {}, benefitTypes: {}, sources: {}, eventCount: 0 });
    expect(resetProfile.productScorecard.coverage.feedbackEvents).toBe(0);
  });

  it('atomically removes explicitly dismissed opportunities from the Inbox', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-dismiss-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:gone', status: 'new', category: 'job', benefitType: 'income', sourceHost: 'jobs.example', supported: true }] });
    const learner = new PreferenceLearner(store);
    await learner.record('opportunity:gone', { signal: 'dismissed' });
    const data = await store.read();
    expect(data.opportunities[0].status).toBe('dismissed');
    expect(data.preferenceFeedback).toHaveLength(1);
  });

  it('does not treat unsupported regex opportunities as useful Finds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-learning-unsupported-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({
      opportunities: [
        { id: 'opportunity:regex', category: 'job', benefitType: 'income', sourceHost: 'careers.example' },
        { id: 'opportunity:jwt', category: 'tool', benefitType: 'capability', sourceHost: 'jwt.io', evidenceId: 'evidence:jwt', supported: false },
      ],
    });
    const learner = new PreferenceLearner(store);
    for (const id of ['opportunity:regex', 'opportunity:jwt']) {
      await expect(learner.record(id, { signal: 'useful' })).rejects.toMatchObject({
        name: 'InboxError',
        code: 'OPPORTUNITY_NOT_SUPPORTED',
        status: 409,
      });
      await expect(learner.record(id, { signal: 'saved' })).rejects.toBeInstanceOf(InboxError);
    }
    const data = await store.read();
    expect(data.preferenceFeedback ?? []).toEqual([]);
    const profile = await learner.profile();
    expect(profile.eventCount).toBe(0);
    expect(profile.categories).toEqual({});
  });
});
