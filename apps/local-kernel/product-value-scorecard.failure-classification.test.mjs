import { describe, expect, it } from 'vitest';
import { buildProductValueScorecard } from './product-value-scorecard.mjs';

const authorization = (goalId, decidedAt) => ({
  decision: 'approved',
  scope: 'read_only_continuation',
  goalId,
  goalRevision: 1,
  decidedAt,
});

const productCohort = {
  schemaVersion: 'efesto.local-product-cohort.v1',
  unit: 'local_installation',
  startedAt: '2026-10-05T00:00:00.000Z',
};

describe('product scorecard mission failure truth', () => {
  it('excludes verified_without_support from technical mission failures while keeping it in the denominator', () => {
    const scorecard = buildProductValueScorecard({
      productCohort,
      agentMissions: [
        {
          id: 'mission:no-support',
          goalId: 'goal:no-support',
          status: 'failed',
          executionPhase: 'failed',
          lastFailure: { code: 'verified_without_support' },
          authorization: authorization('goal:no-support', '2026-10-05T00:01:00.000Z'),
        },
        {
          id: 'mission:web-read-failed',
          goalId: 'goal:web-read-failed',
          status: 'failed',
          executionPhase: 'failed',
          lastFailure: { code: 'web_read_failed' },
          authorization: authorization('goal:web-read-failed', '2026-10-05T00:02:00.000Z'),
        },
        {
          id: 'mission:forged',
          goalId: 'goal:forged',
          status: 'completed',
          executionPhase: 'forged',
          authorization: authorization('goal:forged', '2026-10-05T00:03:00.000Z'),
        },
      ],
    }, { now: '2026-10-05T00:10:00.000Z' });

    expect(scorecard.guardrails.missionFailureRate).toMatchObject({
      status: 'measured',
      value: 0.3333,
      numerator: 1,
      denominator: 3,
      verifiedWithoutSupportExcluded: 1,
    });
  });

  it('still counts an unclassified failed mission as a technical failure', () => {
    const scorecard = buildProductValueScorecard({
      productCohort,
      agentMissions: [
        {
          id: 'mission:runtime-failed',
          goalId: 'goal:runtime-failed',
          status: 'failed',
          authorization: authorization('goal:runtime-failed', '2026-10-05T00:01:00.000Z'),
        },
      ],
    }, { now: '2026-10-05T00:10:00.000Z' });

    expect(scorecard.guardrails.missionFailureRate).toMatchObject({
      status: 'measured',
      value: 1,
      numerator: 1,
      denominator: 1,
      verifiedWithoutSupportExcluded: 0,
    });
  });
});
