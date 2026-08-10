import { KernelContractError } from './parse';

export type ProductMetricUnit = 'ratio' | 'milliseconds' | 'count_per_goal' | 'count';
export type ProductMetric = Record<string, unknown> & {
  status: 'measured' | 'not_measurable';
  unit: ProductMetricUnit;
  value: number | null;
  reason: string | null;
};

export type ProductValueScorecard = {
  schemaVersion: 'efesto.product-scorecard.v1';
  sourceOfTruth: 'local_kernel';
  observedAt: string;
  privacy: { mode: 'local_only'; externalTelemetry: false };
  primary: {
    goalUsefulFindRate: ProductMetric;
    timeToFirstUsefulFind: ProductMetric;
    repeatGoalUsage: ProductMetric;
  };
  drivers: {
    missionCompletionRate: ProductMetric;
    findsPerCompletedGoal: ProductMetric;
    usefulSavedFindShare: ProductMetric;
    installationToFirstGoalActivationRate: ProductMetric;
    goalToNotificationDeliveryRate: ProductMetric;
  };
  guardrails: {
    missionFailureRate: ProductMetric;
    findDismissalNotInterestedRate: ProductMetric;
    alteredReplayAcceptance: ProductMetric;
    unauthorizedMemoryAdmission: ProductMetric;
    credentialPrivacyLeakageIncidents: ProductMetric;
    packagedInstallRepairSuccess: ProductMetric;
  };
  coverage: {
    executedGoals: number;
    completedGoals: number;
    goalLinkedFinds: number;
    feedbackEvents: number;
    orphanFeedbackEvents: number;
    invalidTimestampEvents: number;
  };
};

export function parseProductScorecardPreferences(value: unknown): ProductValueScorecard {
  const body = record(value, 'preferences');
  literal(body.ok, 'preferences.ok', true);
  const profile = record(body.profile, 'preferences.profile');
  return parseProductScorecard(profile.productScorecard, 'preferences.profile.productScorecard');
}

function parseProductScorecard(value: unknown, path: string): ProductValueScorecard {
  const scorecard = record(value, path);
  const privacy = record(scorecard.privacy, `${path}.privacy`);
  const primary = record(scorecard.primary, `${path}.primary`);
  const drivers = record(scorecard.drivers, `${path}.drivers`);
  const guardrails = record(scorecard.guardrails, `${path}.guardrails`);
  const coverage = record(scorecard.coverage, `${path}.coverage`);
  const observedAt = nonEmptyString(scorecard.observedAt, `${path}.observedAt`);
  if (!Number.isFinite(Date.parse(observedAt))) throw new KernelContractError(`${path}.observedAt`, 'expected ISO-compatible timestamp');

  return {
    schemaVersion: literal(scorecard.schemaVersion, `${path}.schemaVersion`, 'efesto.product-scorecard.v1'),
    sourceOfTruth: literal(scorecard.sourceOfTruth, `${path}.sourceOfTruth`, 'local_kernel'),
    observedAt,
    privacy: {
      mode: literal(privacy.mode, `${path}.privacy.mode`, 'local_only'),
      externalTelemetry: literal(privacy.externalTelemetry, `${path}.privacy.externalTelemetry`, false),
    },
    primary: {
      goalUsefulFindRate: metric(primary.goalUsefulFindRate, `${path}.primary.goalUsefulFindRate`, 'ratio'),
      timeToFirstUsefulFind: metric(primary.timeToFirstUsefulFind, `${path}.primary.timeToFirstUsefulFind`, 'milliseconds'),
      repeatGoalUsage: metric(primary.repeatGoalUsage, `${path}.primary.repeatGoalUsage`, 'ratio'),
    },
    drivers: {
      missionCompletionRate: metric(drivers.missionCompletionRate, `${path}.drivers.missionCompletionRate`, 'ratio'),
      findsPerCompletedGoal: metric(drivers.findsPerCompletedGoal, `${path}.drivers.findsPerCompletedGoal`, 'count_per_goal'),
      usefulSavedFindShare: metric(drivers.usefulSavedFindShare, `${path}.drivers.usefulSavedFindShare`, 'ratio'),
      installationToFirstGoalActivationRate: metric(drivers.installationToFirstGoalActivationRate, `${path}.drivers.installationToFirstGoalActivationRate`, 'ratio'),
      goalToNotificationDeliveryRate: metric(drivers.goalToNotificationDeliveryRate, `${path}.drivers.goalToNotificationDeliveryRate`, 'ratio'),
    },
    guardrails: {
      missionFailureRate: metric(guardrails.missionFailureRate, `${path}.guardrails.missionFailureRate`, 'ratio'),
      findDismissalNotInterestedRate: metric(guardrails.findDismissalNotInterestedRate, `${path}.guardrails.findDismissalNotInterestedRate`, 'ratio'),
      alteredReplayAcceptance: metric(guardrails.alteredReplayAcceptance, `${path}.guardrails.alteredReplayAcceptance`, 'count'),
      unauthorizedMemoryAdmission: metric(guardrails.unauthorizedMemoryAdmission, `${path}.guardrails.unauthorizedMemoryAdmission`, 'count'),
      credentialPrivacyLeakageIncidents: metric(guardrails.credentialPrivacyLeakageIncidents, `${path}.guardrails.credentialPrivacyLeakageIncidents`, 'count'),
      packagedInstallRepairSuccess: metric(guardrails.packagedInstallRepairSuccess, `${path}.guardrails.packagedInstallRepairSuccess`, 'ratio'),
    },
    coverage: {
      executedGoals: nonNegativeInteger(coverage.executedGoals, `${path}.coverage.executedGoals`),
      completedGoals: nonNegativeInteger(coverage.completedGoals, `${path}.coverage.completedGoals`),
      goalLinkedFinds: nonNegativeInteger(coverage.goalLinkedFinds, `${path}.coverage.goalLinkedFinds`),
      feedbackEvents: nonNegativeInteger(coverage.feedbackEvents, `${path}.coverage.feedbackEvents`),
      orphanFeedbackEvents: nonNegativeInteger(coverage.orphanFeedbackEvents, `${path}.coverage.orphanFeedbackEvents`),
      invalidTimestampEvents: nonNegativeInteger(coverage.invalidTimestampEvents, `${path}.coverage.invalidTimestampEvents`),
    },
  };
}

function metric(value: unknown, path: string, expectedUnit: ProductMetricUnit): ProductMetric {
  const input = record(value, path);
  const status = enumeration(input.status, `${path}.status`, ['measured', 'not_measurable'] as const);
  const unit = literal(input.unit, `${path}.unit`, expectedUnit);
  if (status === 'measured') {
    const metricValue = nonNegativeNumber(input.value, `${path}.value`);
    if (unit === 'ratio' && metricValue > 1) throw new KernelContractError(`${path}.value`, 'expected ratio from 0 to 1');
    if (input.reason !== null) throw new KernelContractError(`${path}.reason`, 'expected null for measured metric');
    return { ...input, status, unit, value: metricValue, reason: null };
  }
  if (input.value !== null) throw new KernelContractError(`${path}.value`, 'expected null when metric is not measurable');
  return { ...input, status, unit, value: null, reason: nonEmptyString(input.reason, `${path}.reason`) };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new KernelContractError(path, 'expected object');
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new KernelContractError(path, 'expected non-empty string');
  return value;
}

function nonNegativeNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new KernelContractError(path, 'expected non-negative finite number');
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const result = nonNegativeNumber(value, path);
  if (!Number.isSafeInteger(result)) throw new KernelContractError(path, 'expected non-negative safe integer');
  return result;
}

function literal<T extends string | boolean>(value: unknown, path: string, expected: T): T {
  if (value !== expected) throw new KernelContractError(path, `expected ${String(expected)}`);
  return expected;
}

function enumeration<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new KernelContractError(path, `expected one of ${values.join(', ')}`);
  return value as T;
}
