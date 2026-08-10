const POSITIVE_SIGNALS = new Set(['useful', 'saved']);
const NEGATIVE_SIGNALS = new Set(['dismissed', 'not_interested']);

export const PRODUCT_SCORECARD_SCHEMA_VERSION = 'efesto.product-scorecard.v1';

export function buildProductValueScorecard(data = {}, options = {}) {
  const observedAt = normalizeObservedAt(options.now);
  const missions = asArray(data.agentMissions);
  const evidence = asArray(data.evidence);
  const opportunities = asArray(data.opportunities);
  const feedback = asArray(data.preferenceFeedback);

  const missionById = indexById(missions);
  const evidenceById = indexById(evidence);
  const executedGoals = new Map();
  const completedGoalKeys = new Set();
  const goalLinkedFinds = new Map();
  let invalidTimestampEvents = 0;

  for (const mission of missions) {
    const execution = executionIdentity(mission);
    if (!execution) continue;
    const previous = executedGoals.get(execution.key);
    if (!previous || Date.parse(execution.decidedAt) < Date.parse(previous.decidedAt)) {
      executedGoals.set(execution.key, execution);
    }
    if (mission?.status === 'completed') completedGoalKeys.add(execution.key);
  }

  for (const opportunity of opportunities) {
    if (!validId(opportunity?.id)) continue;
    const evidenceRecord = validId(opportunity?.evidenceId) ? evidenceById.get(opportunity.evidenceId) : undefined;
    const mission = evidenceRecord && validId(evidenceRecord.missionId) ? missionById.get(evidenceRecord.missionId) : undefined;
    const execution = executionIdentity(mission);
    if (!execution) continue;
    goalLinkedFinds.set(opportunity.id, { opportunity, execution });
  }

  const positiveFindIds = new Set();
  const negativeFindIds = new Set();
  const firstPositiveAtByGoal = new Map();
  let orphanFeedbackEvents = 0;

  for (const event of feedback) {
    const signal = event?.signal;
    if (!POSITIVE_SIGNALS.has(signal) && !NEGATIVE_SIGNALS.has(signal)) continue;
    const linked = validId(event?.opportunityId) ? goalLinkedFinds.get(event.opportunityId) : undefined;
    if (!linked) {
      orphanFeedbackEvents += 1;
      continue;
    }
    const recordedAtMs = Date.parse(event?.recordedAt);
    const decidedAtMs = Date.parse(linked.execution.decidedAt);
    if (!Number.isFinite(recordedAtMs) || !Number.isFinite(decidedAtMs) || recordedAtMs < decidedAtMs) {
      invalidTimestampEvents += 1;
      continue;
    }
    if (POSITIVE_SIGNALS.has(signal)) {
      positiveFindIds.add(event.opportunityId);
      const current = firstPositiveAtByGoal.get(linked.execution.key);
      if (!current || recordedAtMs < current.recordedAtMs) {
        firstPositiveAtByGoal.set(linked.execution.key, { recordedAtMs, decidedAtMs });
      }
    }
    if (NEGATIVE_SIGNALS.has(signal)) negativeFindIds.add(event.opportunityId);
  }

  const firstUsefulSamples = [...firstPositiveAtByGoal.values()]
    .map(({ recordedAtMs, decidedAtMs }) => recordedAtMs - decidedAtMs)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  const completedGoalFindIds = [...goalLinkedFinds.entries()]
    .filter(([, linked]) => completedGoalKeys.has(linked.execution.key))
    .map(([opportunityId]) => opportunityId);

  return {
    schemaVersion: PRODUCT_SCORECARD_SCHEMA_VERSION,
    sourceOfTruth: 'local_kernel',
    observedAt,
    privacy: { mode: 'local_only', externalTelemetry: false },
    primary: {
      goalUsefulFindRate: ratioMetric(firstPositiveAtByGoal.size, executedGoals.size, 'no_executed_goals'),
      timeToFirstUsefulFind: durationMetric(firstUsefulSamples, 'no_useful_or_saved_find_feedback'),
      repeatGoalUsage: unavailableMetric('ratio', 'user_cohort_identity_unavailable', {
        localExecutedGoalCount: executedGoals.size,
        localRepeatGoalObserved: executedGoals.size >= 2,
      }),
    },
    drivers: {
      missionCompletionRate: ratioMetric(missions.filter((mission) => mission?.status === 'completed').length, missions.length, 'no_missions'),
      findsPerCompletedGoal: averageMetric(completedGoalFindIds.length, completedGoalKeys.size, 'no_completed_goals'),
      usefulSavedFindShare: ratioMetric(positiveFindIds.size, goalLinkedFinds.size, 'no_goal_linked_finds'),
      installationToFirstGoalActivationRate: unavailableMetric('ratio', 'installation_cohort_not_recorded'),
      goalToNotificationDeliveryRate: unavailableMetric('ratio', 'notification_delivery_ledger_unavailable'),
    },
    guardrails: {
      missionFailureRate: ratioMetric(missions.filter((mission) => mission?.status === 'failed').length, missions.length, 'no_missions'),
      findDismissalNotInterestedRate: ratioMetric(negativeFindIds.size, goalLinkedFinds.size, 'no_goal_linked_finds'),
      alteredReplayAcceptance: unavailableMetric('count', 'security_event_ledger_unavailable', { target: 0 }),
      unauthorizedMemoryAdmission: unavailableMetric('count', 'security_event_ledger_unavailable', { target: 0 }),
      credentialPrivacyLeakageIncidents: unavailableMetric('count', 'security_incident_ledger_unavailable', { target: 0 }),
      packagedInstallRepairSuccess: unavailableMetric('ratio', 'release_ci_evidence_not_in_local_store', { target: 1 }),
    },
    coverage: {
      executedGoals: executedGoals.size,
      completedGoals: completedGoalKeys.size,
      goalLinkedFinds: goalLinkedFinds.size,
      feedbackEvents: feedback.length,
      orphanFeedbackEvents,
      invalidTimestampEvents,
    },
  };
}

function executionIdentity(mission) {
  const authorization = mission?.authorization;
  if (!validId(mission?.goalId) || !authorization || typeof authorization !== 'object') return undefined;
  if (authorization.decision !== 'approved' || authorization.scope !== 'read_only_continuation') return undefined;
  if (authorization.goalId !== mission.goalId) return undefined;
  const goalRevision = Number(authorization.goalRevision);
  if (!Number.isInteger(goalRevision) || goalRevision < 1) return undefined;
  const decidedAtMs = Date.parse(authorization.decidedAt);
  if (!Number.isFinite(decidedAtMs)) return undefined;
  return {
    key: `${mission.goalId}@${goalRevision}`,
    goalId: mission.goalId,
    goalRevision,
    missionId: mission.id,
    decidedAt: new Date(decidedAtMs).toISOString(),
  };
}

function ratioMetric(numerator, denominator, emptyReason) {
  return denominator > 0
    ? measuredMetric('ratio', numerator / denominator, { numerator, denominator })
    : unavailableMetric('ratio', emptyReason, { numerator, denominator });
}

function averageMetric(total, denominator, emptyReason) {
  return denominator > 0
    ? measuredMetric('count_per_goal', total / denominator, { numerator: total, denominator })
    : unavailableMetric('count_per_goal', emptyReason, { numerator: total, denominator });
}

function durationMetric(samples, emptyReason) {
  if (!samples.length) return unavailableMetric('milliseconds', emptyReason, { sampleCount: 0 });
  return measuredMetric('milliseconds', median(samples), {
    sampleCount: samples.length,
    minimum: samples[0],
    maximum: samples[samples.length - 1],
  });
}

function measuredMetric(unit, value, details = {}) {
  return { status: 'measured', unit, value: round(value), reason: null, ...details };
}

function unavailableMetric(unit, reason, details = {}) {
  return { status: 'not_measurable', unit, value: null, reason, ...details };
}

function median(values) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function round(value) {
  return Number.isInteger(value) ? value : Math.round(value * 10_000) / 10_000;
}

function normalizeObservedAt(value) {
  const source = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(source.getTime())) throw new Error('Product scorecard observation time is invalid');
  return source.toISOString();
}

function indexById(items) {
  return new Map(items.filter((item) => validId(item?.id)).map((item) => [item.id, item]));
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
