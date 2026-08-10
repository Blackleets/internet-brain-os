import { describe, expect, it } from 'vitest';
import { buildProductValueScorecard } from './product-value-scorecard.mjs';

const authorization = (goalId, decidedAt) => ({
  decision: 'approved',
  scope: 'read_only_continuation',
  goalId,
  goalRevision: 1,
  decidedAt,
});

describe('local-first product value scorecard', () => {
  it('measures Goal value from Kernel-linked Finds and explicit private feedback', () => {
    const scorecard = buildProductValueScorecard({
      agentMissions: [
        { id: 'mission:1', goalId: 'goal:1', status: 'completed', authorization: authorization('goal:1', '2026-08-10T10:00:00.000Z') },
        { id: 'mission:2', goalId: 'goal:2', status: 'failed', authorization: authorization('goal:2', '2026-08-10T11:00:00.000Z') },
      ],
      evidence: [
        { id: 'evidence:1', missionId: 'mission:1' },
        { id: 'evidence:2', missionId: 'mission:2' },
      ],
      opportunities: [
        { id: 'opportunity:1', evidenceId: 'evidence:1' },
        { id: 'opportunity:2', evidenceId: 'evidence:2' },
      ],
      preferenceFeedback: [
        { opportunityId: 'opportunity:1', signal: 'useful', recordedAt: '2026-08-10T10:05:00.000Z' },
        { opportunityId: 'opportunity:1', signal: 'saved', recordedAt: '2026-08-10T10:06:00.000Z' },
        { opportunityId: 'opportunity:2', signal: 'not_interested', recordedAt: '2026-08-10T11:10:00.000Z' },
      ],
    }, { now: '2026-08-10T12:00:00.000Z' });

    expect(scorecard).toMatchObject({
      schemaVersion: 'efesto.product-scorecard.v1',
      sourceOfTruth: 'local_kernel',
      privacy: { mode: 'local_only', externalTelemetry: false },
      primary: {
        goalUsefulFindRate: { status: 'measured', value: 0.5, numerator: 1, denominator: 2 },
        timeToFirstUsefulFind: { status: 'measured', value: 300000, sampleCount: 1 },
        repeatGoalUsage: { status: 'not_measurable', reason: 'user_cohort_identity_unavailable', localExecutedGoalCount: 2, localRepeatGoalObserved: true },
      },
      drivers: {
        missionCompletionRate: { status: 'measured', value: 0.5 },
        findsPerCompletedGoal: { status: 'measured', value: 1 },
        usefulSavedFindShare: { status: 'measured', value: 0.5 },
      },
      guardrails: {
        missionFailureRate: { status: 'measured', value: 0.5 },
        findDismissalNotInterestedRate: { status: 'measured', value: 0.5 },
        alteredReplayAcceptance: { status: 'not_measurable', target: 0 },
        unauthorizedMemoryAdmission: { status: 'not_measurable', target: 0 },
      },
      coverage: { executedGoals: 2, completedGoals: 1, goalLinkedFinds: 2, feedbackEvents: 3 },
    });
  });

  it('reports a measurable zero Useful Find Rate while refusing to invent time-to-value without positive feedback', () => {
    const scorecard = buildProductValueScorecard({
      agentMissions: [{ id: 'mission:1', goalId: 'goal:1', status: 'completed', authorization: authorization('goal:1', '2026-08-10T10:00:00.000Z') }],
      evidence: [{ id: 'evidence:1', missionId: 'mission:1' }],
      opportunities: [{ id: 'opportunity:1', evidenceId: 'evidence:1' }],
    }, { now: '2026-08-10T12:00:00.000Z' });

    expect(scorecard.primary.goalUsefulFindRate).toMatchObject({ status: 'measured', value: 0, numerator: 0, denominator: 1 });
    expect(scorecard.primary.timeToFirstUsefulFind).toMatchObject({ status: 'not_measurable', value: null, reason: 'no_useful_or_saved_find_feedback' });
    expect(scorecard.drivers.usefulSavedFindShare).toMatchObject({ status: 'measured', value: 0, numerator: 0, denominator: 1 });
  });

  it('does not let manual Finds or impossible timestamps contaminate Goal metrics', () => {
    const scorecard = buildProductValueScorecard({
      agentMissions: [{ id: 'mission:1', goalId: 'goal:1', status: 'completed', authorization: authorization('goal:1', '2026-08-10T10:00:00.000Z') }],
      evidence: [{ id: 'evidence:1', missionId: 'mission:1' }, { id: 'evidence:manual' }],
      opportunities: [
        { id: 'opportunity:1', evidenceId: 'evidence:1' },
        { id: 'opportunity:manual', evidenceId: 'evidence:manual' },
      ],
      preferenceFeedback: [
        { opportunityId: 'opportunity:1', signal: 'useful', recordedAt: '2026-08-10T09:59:00.000Z' },
        { opportunityId: 'opportunity:manual', signal: 'saved', recordedAt: '2026-08-10T10:01:00.000Z' },
      ],
    }, { now: '2026-08-10T12:00:00.000Z' });

    expect(scorecard.primary.goalUsefulFindRate.value).toBe(0);
    expect(scorecard.coverage).toMatchObject({ goalLinkedFinds: 1, orphanFeedbackEvents: 1, invalidTimestampEvents: 1 });
  });

  it('marks cohort, notification and security-ledger metrics unavailable instead of guessing', () => {
    const scorecard = buildProductValueScorecard({}, { now: '2026-08-10T12:00:00.000Z' });

    expect(scorecard.primary.repeatGoalUsage.reason).toBe('user_cohort_identity_unavailable');
    expect(scorecard.drivers.installationToFirstGoalActivationRate.reason).toBe('installation_cohort_not_recorded');
    expect(scorecard.drivers.goalToNotificationDeliveryRate.reason).toBe('notification_delivery_ledger_unavailable');
    expect(scorecard.guardrails.credentialPrivacyLeakageIncidents).toMatchObject({ status: 'not_measurable', target: 0 });
    expect(scorecard.guardrails.packagedInstallRepairSuccess).toMatchObject({ status: 'not_measurable', target: 1 });
  });
});
