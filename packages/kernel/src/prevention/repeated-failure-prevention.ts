import type { ExecutionRecord } from '../execution/execution-contract';
import type { CognitivePipelineRecord } from '../storage/cognitive-pipeline-types';
import { stableHash } from '../utils/hash';

export type PersistedFailureKind = 'execution' | 'validation' | 'admission';

export interface PersistedFailureReference {
  readonly referenceId: string;
  readonly kind: PersistedFailureKind;
  readonly code: string;
  readonly scope: string;
  readonly occurredAt: string;
}

export type PreventionRecommendationAction =
  | 'review_execution_boundary'
  | 'review_evidence_quality'
  | 'review_admission_conflicts';

export interface RepeatedFailurePreventionRecommendation {
  readonly id: string;
  readonly groupKey: string;
  readonly kind: PersistedFailureKind;
  readonly code: string;
  readonly scope: string;
  readonly referenceIds: readonly string[];
  readonly occurrenceCount: number;
  readonly firstOccurredAt: string;
  readonly lastOccurredAt: string;
  readonly windowMs: number;
  readonly threshold: number;
  readonly evaluatorVersion: string;
  readonly action: PreventionRecommendationAction;
  readonly rationale: string;
  readonly basisHash: string;
  readonly evaluatedAt: string;
}

export interface RepeatedFailurePreventionOptions {
  readonly windowMs: number;
  readonly threshold: number;
  readonly evaluatorVersion: string;
}

export interface PreventionRecommendationFreshness {
  readonly status: 'current' | 'stale';
  readonly reasons: readonly ('evaluator_version_changed' | 'failure_basis_changed')[];
}

/**
 * Extracts only failures that already exist in persisted Execution records.
 * In-doubt reservations are intentionally excluded until reconciliation records
 * a durable failed outcome.
 */
export function failureReferencesFromExecutions(records: readonly ExecutionRecord[]): readonly PersistedFailureReference[] {
  const latestByExecution = new Map<string, ExecutionRecord>();
  for (const record of records) {
    const previous = latestByExecution.get(record.executionId);
    if (!previous || record.sequence > previous.sequence) latestByExecution.set(record.executionId, record);
  }

  return [...latestByExecution.values()]
    .filter((record) => record.status === 'failed' && typeof record.failedAt === 'string')
    .map((record) => normalizeFailureReference({
      referenceId: `${record.executionId}#${record.sequence}`,
      kind: 'execution',
      code: record.failureCode ?? 'execution_failed',
      scope: record.capabilityId,
      occurredAt: record.failedAt!,
    }))
    .sort(compareFailures);
}

/**
 * Projects rejected/review validation and blocked/review admission decisions from
 * persisted cognitive-pipeline records. It never infers agent intent.
 */
export function failureReferencesFromPipelines(records: readonly CognitivePipelineRecord[]): readonly PersistedFailureReference[] {
  const failures: PersistedFailureReference[] = [];

  for (const record of records) {
    if (record.validation.decision !== 'accepted') {
      const reasonCodes = [...new Set(record.validation.reasons.map((reason) => reason.code))].sort();
      for (const code of reasonCodes) {
        failures.push(normalizeFailureReference({
          referenceId: `${record.id}:validation:${code}`,
          kind: 'validation',
          code,
          scope: 'claim-validation',
          occurredAt: record.validation.evaluatedAt,
        }));
      }
    }

    if (record.admission && record.admission.decision !== 'admitted') {
      const contradictionCodes = [...new Set(record.admission.contradiction.reasons
        .filter((reason) => reason.code !== 'no_conflict')
        .map((reason) => reason.code))].sort();
      const codes = contradictionCodes.length > 0
        ? contradictionCodes
        : [`admission_${record.admission.decision}`];
      for (const code of codes) {
        failures.push(normalizeFailureReference({
          referenceId: `${record.id}:admission:${code}`,
          kind: 'admission',
          code,
          scope: 'knowledge-admission',
          occurredAt: record.admission.admittedAt,
        }));
      }
    }
  }

  return dedupeFailures(failures).sort(compareFailures);
}

/**
 * Read-only evaluator. The result can explain a repeated pattern but has no path
 * to mutate Memory, capabilities, approval policy, or external systems.
 */
export class RepeatedFailurePreventionEvaluator {
  private readonly options: RepeatedFailurePreventionOptions;

  constructor(options: RepeatedFailurePreventionOptions) {
    this.options = normalizeOptions(options);
  }

  evaluate(
    failures: readonly PersistedFailureReference[],
    evaluatedAt: string,
  ): readonly RepeatedFailurePreventionRecommendation[] {
    const nowMs = parseTimestamp(evaluatedAt, 'evaluatedAt');
    const floor = nowMs - this.options.windowMs;
    const normalized = dedupeFailures(failures.map(normalizeFailureReference))
      .filter((failure) => {
        const occurred = parseTimestamp(failure.occurredAt, 'occurredAt');
        return occurred >= floor && occurred <= nowMs;
      })
      .sort(compareFailures);

    const groups = new Map<string, PersistedFailureReference[]>();
    for (const failure of normalized) {
      const groupKey = stableGroupKey(failure);
      const group = groups.get(groupKey) ?? [];
      group.push(failure);
      groups.set(groupKey, group);
    }

    return [...groups.entries()]
      .filter(([, group]) => group.length >= this.options.threshold)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([groupKey, group]) => this.toRecommendation(groupKey, group, evaluatedAt));
  }

  assessFreshness(
    recommendation: RepeatedFailurePreventionRecommendation,
    currentFailures: readonly PersistedFailureReference[],
  ): PreventionRecommendationFreshness {
    const reasons: PreventionRecommendationFreshness['reasons'][number][] = [];
    if (recommendation.evaluatorVersion !== this.options.evaluatorVersion) {
      reasons.push('evaluator_version_changed');
    }

    const currentBasisHash = basisHash(
      dedupeFailures(currentFailures.map(normalizeFailureReference))
        .filter((failure) => stableGroupKey(failure) === recommendation.groupKey)
        .map((failure) => failure.referenceId),
    );
    if (currentBasisHash !== recommendation.basisHash) reasons.push('failure_basis_changed');

    return { status: reasons.length === 0 ? 'current' : 'stale', reasons };
  }

  private toRecommendation(
    groupKey: string,
    group: readonly PersistedFailureReference[],
    evaluatedAt: string,
  ): RepeatedFailurePreventionRecommendation {
    const sorted = [...group].sort(compareFailures);
    const referenceIds = sorted.map((failure) => failure.referenceId);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const digest = basisHash(referenceIds);
    const action = actionFor(first.kind);
    return {
      id: `prevention:${stableHash({ groupKey, referenceIds, evaluatorVersion: this.options.evaluatorVersion })}`,
      groupKey,
      kind: first.kind,
      code: first.code,
      scope: first.scope,
      referenceIds,
      occurrenceCount: referenceIds.length,
      firstOccurredAt: first.occurredAt,
      lastOccurredAt: last.occurredAt,
      windowMs: this.options.windowMs,
      threshold: this.options.threshold,
      evaluatorVersion: this.options.evaluatorVersion,
      action,
      rationale: rationaleFor(first.kind, first.code, referenceIds.length),
      basisHash: digest,
      evaluatedAt: new Date(parseTimestamp(evaluatedAt, 'evaluatedAt')).toISOString(),
    };
  }
}

function normalizeOptions(options: RepeatedFailurePreventionOptions): RepeatedFailurePreventionOptions {
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) throw new Error('windowMs must be a positive safe integer');
  if (!Number.isSafeInteger(options.threshold) || options.threshold < 2) throw new Error('threshold must be an integer >= 2');
  return {
    windowMs: options.windowMs,
    threshold: options.threshold,
    evaluatorVersion: clean(options.evaluatorVersion, 'evaluatorVersion'),
  };
}

function normalizeFailureReference(input: PersistedFailureReference): PersistedFailureReference {
  if (!input || typeof input !== 'object') throw new Error('failure reference must be an object');
  if (!['execution', 'validation', 'admission'].includes(input.kind)) throw new Error('failure kind is invalid');
  return {
    referenceId: clean(input.referenceId, 'referenceId'),
    kind: input.kind,
    code: clean(input.code, 'code'),
    scope: clean(input.scope, 'scope'),
    occurredAt: new Date(parseTimestamp(input.occurredAt, 'occurredAt')).toISOString(),
  };
}

function dedupeFailures(failures: readonly PersistedFailureReference[]): PersistedFailureReference[] {
  const byId = new Map<string, PersistedFailureReference>();
  for (const failure of failures) {
    const previous = byId.get(failure.referenceId);
    if (previous && stableHash(previous) !== stableHash(failure)) {
      throw new Error(`altered failure replay for referenceId: ${failure.referenceId}`);
    }
    byId.set(failure.referenceId, failure);
  }
  return [...byId.values()];
}

function stableGroupKey(failure: PersistedFailureReference): string {
  return `${failure.kind}:${failure.scope}:${failure.code}`;
}

function basisHash(referenceIds: readonly string[]): string {
  return stableHash([...new Set(referenceIds)].sort());
}

function compareFailures(left: PersistedFailureReference, right: PersistedFailureReference): number {
  return left.occurredAt.localeCompare(right.occurredAt) || left.referenceId.localeCompare(right.referenceId);
}

function actionFor(kind: PersistedFailureKind): PreventionRecommendationAction {
  if (kind === 'execution') return 'review_execution_boundary';
  if (kind === 'validation') return 'review_evidence_quality';
  return 'review_admission_conflicts';
}

function rationaleFor(kind: PersistedFailureKind, code: string, count: number): string {
  const noun = kind === 'execution' ? 'execution failures' : kind === 'validation' ? 'validation outcomes' : 'admission outcomes';
  return `${count} persisted ${noun} share the explicit code ${code}; review the cited records before changing policy or behavior.`;
}

function parseTimestamp(value: string, field: string): number {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid timestamp`);
  return parsed;
}

function clean(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`${field} is invalid`);
  return normalized;
}
