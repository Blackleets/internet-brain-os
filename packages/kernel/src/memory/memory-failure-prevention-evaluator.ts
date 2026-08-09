import { createHash } from 'node:crypto';
import type { IsoDateTime } from '@internet-brain-os/shared';

export type MemoryFailureCategory =
  | 'altered_replay'
  | 'invalid_evidence'
  | 'provenance_failure'
  | 'contradiction_unresolved'
  | 'admission_rejected'
  | 'policy_denied'
  | 'integrity_failure'
  | 'recovery_review_rejected';

export interface PersistedMemoryFailureRecord {
  readonly failureId: string;
  readonly memoryId: string;
  readonly category: MemoryFailureCategory;
  readonly occurredAt: IsoDateTime;
  readonly referenceIds: readonly string[];
}

export interface MemoryFailurePreventionPolicy {
  readonly policyVersion: string;
  readonly threshold: number;
  readonly windowMs: number;
}

export interface MemoryFailurePreventionEvaluationInput {
  readonly evaluatedAt: IsoDateTime;
  readonly failures: readonly PersistedMemoryFailureRecord[];
  readonly policy: MemoryFailurePreventionPolicy;
}

export interface MemoryFailurePreventionRecommendation {
  readonly recommendationId: string;
  readonly memoryId: string;
  readonly category: MemoryFailureCategory;
  readonly policyVersion: string;
  readonly threshold: number;
  readonly windowMs: number;
  readonly evaluatedAt: IsoDateTime;
  readonly failureIds: readonly string[];
  readonly referenceIds: readonly string[];
  readonly recommendation: 'review_repeated_failure_pattern';
  readonly authority: 'read_only';
}

export interface MemoryFailurePreventionEvaluationResult {
  readonly recommendations: readonly MemoryFailurePreventionRecommendation[];
}

export class MemoryFailurePreventionInputError extends Error {
  readonly name = 'MemoryFailurePreventionInputError';
  constructor(
    readonly code:
      | 'INVALID_EVALUATED_AT'
      | 'INVALID_POLICY'
      | 'INVALID_FAILURE'
      | 'INVALID_REFERENCE_ID',
    message: string,
  ) {
    super(message);
  }
}

const CATEGORY_ORDER: readonly MemoryFailureCategory[] = [
  'altered_replay',
  'invalid_evidence',
  'provenance_failure',
  'contradiction_unresolved',
  'admission_rejected',
  'policy_denied',
  'integrity_failure',
  'recovery_review_rejected',
];

/**
 * Derives read-only prevention recommendations from already-persisted failures.
 * It never changes memory state, capabilities, policies, approvals, or agent permissions.
 */
export function evaluateRepeatedMemoryFailures(
  input: MemoryFailurePreventionEvaluationInput,
): MemoryFailurePreventionEvaluationResult {
  const evaluatedAt = requireDate(input.evaluatedAt, 'evaluatedAt');
  const policyVersion = required(input.policy.policyVersion, 'policyVersion');
  if (!Number.isSafeInteger(input.policy.threshold) || input.policy.threshold < 2) {
    throw new MemoryFailurePreventionInputError(
      'INVALID_POLICY',
      'threshold must be a safe integer greater than or equal to 2.',
    );
  }
  if (!Number.isSafeInteger(input.policy.windowMs) || input.policy.windowMs <= 0) {
    throw new MemoryFailurePreventionInputError(
      'INVALID_POLICY',
      'windowMs must be a positive safe integer.',
    );
  }

  const evaluatedAtMs = Date.parse(evaluatedAt);
  const windowStart = evaluatedAtMs - input.policy.windowMs;
  const uniqueFailures = new Map<string, PersistedMemoryFailureRecord>();

  for (const rawFailure of input.failures) {
    const failure = normalizeFailure(rawFailure);
    const occurredAtMs = Date.parse(failure.occurredAt);
    if (occurredAtMs > evaluatedAtMs || occurredAtMs < windowStart) continue;

    const existing = uniqueFailures.get(failure.failureId);
    if (existing && stableStringify(existing) !== stableStringify(failure)) {
      throw new MemoryFailurePreventionInputError(
        'INVALID_FAILURE',
        `failureId ${failure.failureId} is bound to conflicting persisted failure data.`,
      );
    }
    uniqueFailures.set(failure.failureId, failure);
  }

  const grouped = new Map<string, PersistedMemoryFailureRecord[]>();
  for (const failure of uniqueFailures.values()) {
    const key = `${failure.memoryId}\u0000${failure.category}`;
    const group = grouped.get(key) ?? [];
    group.push(failure);
    grouped.set(key, group);
  }

  const recommendations: MemoryFailurePreventionRecommendation[] = [];
  for (const group of grouped.values()) {
    if (group.length < input.policy.threshold) continue;
    const ordered = [...group].sort(compareFailure);
    const memoryId = ordered[0].memoryId;
    const category = ordered[0].category;
    const failureIds = ordered.map((failure) => failure.failureId).sort();
    const referenceIds = [...new Set(ordered.flatMap((failure) => failure.referenceIds))].sort();
    const identityBasis = {
      memoryId,
      category,
      policyVersion,
      threshold: input.policy.threshold,
      windowMs: input.policy.windowMs,
      failureIds,
      referenceIds,
    };
    recommendations.push({
      recommendationId: `memory-prevention:${digest(identityBasis).slice(0, 32)}`,
      memoryId,
      category,
      policyVersion,
      threshold: input.policy.threshold,
      windowMs: input.policy.windowMs,
      evaluatedAt: evaluatedAt as IsoDateTime,
      failureIds,
      referenceIds,
      recommendation: 'review_repeated_failure_pattern',
      authority: 'read_only',
    });
  }

  return {
    recommendations: recommendations.sort((left, right) =>
      left.memoryId.localeCompare(right.memoryId)
      || CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category)),
  };
}

export function isMemoryFailurePreventionRecommendationStale(
  recommendation: MemoryFailurePreventionRecommendation,
  current: {
    readonly policyVersion: string;
    readonly threshold: number;
    readonly windowMs: number;
    readonly activeFailureIds: readonly string[];
  },
): boolean {
  const policyVersion = required(current.policyVersion, 'policyVersion');
  if (!Number.isSafeInteger(current.threshold) || current.threshold < 2) return true;
  if (!Number.isSafeInteger(current.windowMs) || current.windowMs <= 0) return true;
  const activeFailureIds = normalizeIds(current.activeFailureIds, 'failure id');
  return recommendation.policyVersion !== policyVersion
    || recommendation.threshold !== current.threshold
    || recommendation.windowMs !== current.windowMs
    || stableStringify(recommendation.failureIds) !== stableStringify(activeFailureIds);
}

function normalizeFailure(raw: PersistedMemoryFailureRecord): PersistedMemoryFailureRecord {
  const failureId = required(raw.failureId, 'failureId');
  const memoryId = required(raw.memoryId, 'memoryId');
  if (!CATEGORY_ORDER.includes(raw.category)) {
    throw new MemoryFailurePreventionInputError('INVALID_FAILURE', 'Unsupported failure category.');
  }
  const occurredAt = requireDate(raw.occurredAt, 'occurredAt');
  const referenceIds = normalizeIds(raw.referenceIds, 'reference id');
  if (referenceIds.length === 0) {
    throw new MemoryFailurePreventionInputError(
      'INVALID_REFERENCE_ID',
      'Persisted failure requires at least one inspectable reference id.',
    );
  }
  return { failureId, memoryId, category: raw.category, occurredAt: occurredAt as IsoDateTime, referenceIds };
}

function normalizeIds(values: readonly string[], field: string): string[] {
  const result = values.map((value) => required(value, field));
  return [...new Set(result)].sort();
}

function compareFailure(left: PersistedMemoryFailureRecord, right: PersistedMemoryFailureRecord): number {
  return Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    || left.failureId.localeCompare(right.failureId);
}

function required(value: string, field: string): string {
  const normalized = String(value).trim();
  if (!normalized) {
    throw new MemoryFailurePreventionInputError('INVALID_FAILURE', `${field} is required.`);
  }
  return normalized;
}

function requireDate(value: IsoDateTime, field: string): string {
  const normalized = String(value).trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new MemoryFailurePreventionInputError(
      field === 'evaluatedAt' ? 'INVALID_EVALUATED_AT' : 'INVALID_FAILURE',
      `${field} must be a valid date-time.`,
    );
  }
  return normalized;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
