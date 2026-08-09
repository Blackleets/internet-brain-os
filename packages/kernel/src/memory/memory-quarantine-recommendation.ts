import { createHash } from 'node:crypto';
import type { MemoryAuthorityState } from './memory-authority-lifecycle';

export type MemoryQuarantineSignalType =
  | 'unresolved_contradiction'
  | 'evidence_invalidation'
  | 'provenance_gap'
  | 'source_integrity_risk'
  | 'admission_inconsistency'
  | 'policy_violation'
  | 'supersession_conflict';

export type MemoryQuarantineSignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PersistedMemoryQuarantineSignal {
  readonly signalId: string;
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly type: MemoryQuarantineSignalType;
  readonly severity: MemoryQuarantineSignalSeverity;
  readonly referenceIds: readonly string[];
  readonly evaluatorVersion: string;
  readonly observedAt: string;
}

export interface MemoryQuarantineRecommendation {
  readonly recommendationId: string;
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly signals: readonly PersistedMemoryQuarantineSignal[];
  readonly recommendedAt: string;
  readonly evaluatorVersion: string;
  readonly status: 'pending';
  readonly integrityDigest: string;
}

export type MemoryQuarantineEvaluationResult =
  | { readonly kind: 'recommended'; readonly recommendation: MemoryQuarantineRecommendation }
  | {
      readonly kind: 'not_recommended';
      readonly reason: 'STATE_NOT_ELIGIBLE' | 'NO_PERSISTED_SIGNALS';
    };

export interface EvaluateMemoryQuarantineRecommendationInput {
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly state: MemoryAuthorityState;
  readonly signals: readonly PersistedMemoryQuarantineSignal[];
  readonly evaluatorVersion: string;
}

export class MemoryQuarantineRecommendationError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'SIGNAL_MEMORY_MISMATCH'
      | 'SIGNAL_REVISION_MISMATCH'
      | 'ALTERED_SIGNAL_REPLAY',
    message: string,
  ) {
    super(message);
    this.name = 'MemoryQuarantineRecommendationError';
  }
}

const ELIGIBLE_STATES = new Set<MemoryAuthorityState>(['proposed', 'admitted']);

export function evaluateMemoryQuarantineRecommendation(
  input: EvaluateMemoryQuarantineRecommendationInput,
): MemoryQuarantineEvaluationResult {
  const memoryId = required(input.memoryId, 'memoryId');
  const evaluatorVersion = required(input.evaluatorVersion, 'evaluatorVersion');
  const lifecycleRevision = normalizeRevision(input.lifecycleRevision);

  if (!ELIGIBLE_STATES.has(input.state)) {
    return { kind: 'not_recommended', reason: 'STATE_NOT_ELIGIBLE' };
  }

  const signals = normalizeSignals(input.signals, memoryId, lifecycleRevision);
  if (signals.length === 0) {
    return { kind: 'not_recommended', reason: 'NO_PERSISTED_SIGNALS' };
  }

  const recommendedAt = signals
    .map((signal) => signal.observedAt)
    .sort((left, right) => left.localeCompare(right))
    .at(-1)!;
  const base = {
    memoryId,
    lifecycleRevision,
    signals,
    recommendedAt,
    evaluatorVersion,
    status: 'pending' as const,
  };
  const integrityDigest = digest(base);

  return {
    kind: 'recommended',
    recommendation: {
      ...base,
      recommendationId: `memory-quarantine-recommendation:${integrityDigest}`,
      integrityDigest,
    },
  };
}

export function verifyMemoryQuarantineRecommendationIntegrity(
  recommendation: MemoryQuarantineRecommendation,
): boolean {
  const {
    recommendationId,
    integrityDigest,
    memoryId,
    lifecycleRevision,
    signals,
    recommendedAt,
    evaluatorVersion,
    status,
  } = recommendation;
  const base = {
    memoryId,
    lifecycleRevision,
    signals: signals.map(cloneSignal),
    recommendedAt,
    evaluatorVersion,
    status,
  };
  const expected = digest(base);
  return integrityDigest === expected && recommendationId === `memory-quarantine-recommendation:${expected}`;
}

export function isMemoryQuarantineRecommendationStale(
  recommendation: MemoryQuarantineRecommendation,
  current: { readonly lifecycleRevision: number; readonly state: MemoryAuthorityState },
): boolean {
  return (
    recommendation.lifecycleRevision !== current.lifecycleRevision ||
    !ELIGIBLE_STATES.has(current.state)
  );
}

export function cloneMemoryQuarantineRecommendation(
  recommendation: MemoryQuarantineRecommendation,
): MemoryQuarantineRecommendation {
  return {
    ...recommendation,
    signals: recommendation.signals.map(cloneSignal),
  };
}

function normalizeSignals(
  values: readonly PersistedMemoryQuarantineSignal[],
  memoryId: string,
  lifecycleRevision: number,
): readonly PersistedMemoryQuarantineSignal[] {
  const byId = new Map<string, PersistedMemoryQuarantineSignal>();

  for (const value of values) {
    const normalized = normalizeSignal(value);
    if (normalized.memoryId !== memoryId) {
      throw new MemoryQuarantineRecommendationError(
        'SIGNAL_MEMORY_MISMATCH',
        `Signal ${normalized.signalId} belongs to a different memory.`,
      );
    }
    if (normalized.lifecycleRevision !== lifecycleRevision) {
      throw new MemoryQuarantineRecommendationError(
        'SIGNAL_REVISION_MISMATCH',
        `Signal ${normalized.signalId} belongs to lifecycle revision ${normalized.lifecycleRevision}, not ${lifecycleRevision}.`,
      );
    }

    const existing = byId.get(normalized.signalId);
    if (existing && stableStringify(existing) !== stableStringify(normalized)) {
      throw new MemoryQuarantineRecommendationError(
        'ALTERED_SIGNAL_REPLAY',
        `Signal id ${normalized.signalId} was supplied with different normalized content.`,
      );
    }
    byId.set(normalized.signalId, normalized);
  }

  return [...byId.values()].sort((left, right) => left.signalId.localeCompare(right.signalId));
}

function normalizeSignal(value: PersistedMemoryQuarantineSignal): PersistedMemoryQuarantineSignal {
  const referenceIds = [...new Set(value.referenceIds.map((entry) => required(entry, 'signal reference id')))].sort();
  if (referenceIds.length === 0) {
    throw new MemoryQuarantineRecommendationError(
      'INVALID_INPUT',
      'A quarantine signal requires at least one persisted reference id.',
    );
  }

  return {
    signalId: required(value.signalId, 'signalId'),
    memoryId: required(value.memoryId, 'signal memoryId'),
    lifecycleRevision: normalizeRevision(value.lifecycleRevision),
    type: value.type,
    severity: value.severity,
    referenceIds,
    evaluatorVersion: required(value.evaluatorVersion, 'signal evaluatorVersion'),
    observedAt: normalizeTimestamp(value.observedAt, 'signal observedAt'),
  };
}

function cloneSignal(value: PersistedMemoryQuarantineSignal): PersistedMemoryQuarantineSignal {
  return { ...value, referenceIds: [...value.referenceIds] };
}

function normalizeRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MemoryQuarantineRecommendationError(
      'INVALID_INPUT',
      'lifecycleRevision must be a non-negative safe integer.',
    );
  }
  return value;
}

function normalizeTimestamp(value: string, field: string): string {
  const normalized = required(value, field);
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new MemoryQuarantineRecommendationError('INVALID_INPUT', `${field} must be a valid timestamp.`);
  }
  return new Date(timestamp).toISOString();
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemoryQuarantineRecommendationError('INVALID_INPUT', `${field} is required.`);
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
