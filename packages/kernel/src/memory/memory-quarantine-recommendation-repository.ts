import { createHash } from 'node:crypto';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  deriveMemoryQuarantineRecommendationId,
  type MemoryQuarantineRecommendation,
  type MemoryQuarantineSignal,
  type MemoryQuarantineSignalSeverity,
  type MemoryQuarantineSignalType,
} from './memory-quarantine-signal-evaluator';

export interface StoredMemoryQuarantineRecommendation extends MemoryQuarantineRecommendation {
  readonly basisDigest: string;
  readonly integrityDigest: string;
}

export type MemoryQuarantineRecommendationAppendResult =
  | { readonly kind: 'appended'; readonly recommendation: StoredMemoryQuarantineRecommendation }
  | { readonly kind: 'replayed'; readonly recommendation: StoredMemoryQuarantineRecommendation };

export class MemoryQuarantineRecommendationConflictError extends Error {
  readonly name = 'MemoryQuarantineRecommendationConflictError';

  constructor(
    readonly code: 'INVALID_INPUT' | 'INVALID_IDENTITY' | 'ALTERED_REPLAY' | 'INVALID_INTEGRITY',
    message: string,
  ) {
    super(message);
  }
}

export interface MemoryQuarantineRecommendationRepository {
  append(recommendation: MemoryQuarantineRecommendation): MemoryQuarantineRecommendationAppendResult;
  list(memoryId?: string): readonly StoredMemoryQuarantineRecommendation[];
  getById(recommendationId: string): StoredMemoryQuarantineRecommendation | undefined;
}

export class InMemoryMemoryQuarantineRecommendationRepository
implements MemoryQuarantineRecommendationRepository {
  private readonly byId = new Map<string, StoredMemoryQuarantineRecommendation>();
  private readonly idsByMemory = new Map<string, string[]>();

  append(recommendation: MemoryQuarantineRecommendation): MemoryQuarantineRecommendationAppendResult {
    const normalized = normalizeRecommendation(recommendation);
    const basisDigest = digest(recommendationBasis(normalized));
    const existing = this.byId.get(normalized.recommendationId);

    if (existing) {
      if (existing.basisDigest !== basisDigest) {
        throw new MemoryQuarantineRecommendationConflictError(
          'ALTERED_REPLAY',
          'The recommendationId is already bound to a different normalized recommendation basis.',
        );
      }
      return { kind: 'replayed', recommendation: cloneStored(existing) };
    }

    const storedBase = { ...normalized, basisDigest };
    const integrityDigest = digest(storedBase);
    const stored: StoredMemoryQuarantineRecommendation = { ...storedBase, integrityDigest };
    this.byId.set(stored.recommendationId, cloneStored(stored));
    const ids = this.idsByMemory.get(stored.memoryId) ?? [];
    this.idsByMemory.set(stored.memoryId, [...ids, stored.recommendationId]);
    return { kind: 'appended', recommendation: cloneStored(stored) };
  }

  list(memoryId?: string): readonly StoredMemoryQuarantineRecommendation[] {
    if (memoryId === undefined) return [...this.byId.values()].map(cloneStored);
    const normalized = required(memoryId, 'memoryId');
    return (this.idsByMemory.get(normalized) ?? [])
      .map((id) => this.byId.get(id))
      .filter((entry): entry is StoredMemoryQuarantineRecommendation => Boolean(entry))
      .map(cloneStored);
  }

  getById(recommendationId: string): StoredMemoryQuarantineRecommendation | undefined {
    const stored = this.byId.get(required(recommendationId, 'recommendationId'));
    return stored ? cloneStored(stored) : undefined;
  }
}

export type MemoryQuarantineRecommendationStaleReason =
  | 'lifecycle_revision_changed'
  | 'evaluator_version_changed'
  | 'signal_basis_changed';

export interface MemoryQuarantineRecommendationFreshnessContext {
  readonly currentLifecycleRevision: number;
  readonly currentEvaluatorVersion: string;
  readonly currentSignals: readonly MemoryQuarantineSignal[];
}

export type MemoryQuarantineRecommendationFreshness =
  | { readonly status: 'fresh'; readonly staleReasons: readonly [] }
  | { readonly status: 'stale'; readonly staleReasons: readonly MemoryQuarantineRecommendationStaleReason[] };

export function assessMemoryQuarantineRecommendationFreshness(
  recommendation: StoredMemoryQuarantineRecommendation | MemoryQuarantineRecommendation,
  context: MemoryQuarantineRecommendationFreshnessContext,
): MemoryQuarantineRecommendationFreshness {
  const normalized = normalizeRecommendation(recommendation);
  if (!isRecord(context)) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'freshness context must be an object.');
  }
  if (!Number.isSafeInteger(context.currentLifecycleRevision) || context.currentLifecycleRevision < 0) {
    throw new MemoryQuarantineRecommendationConflictError(
      'INVALID_INPUT',
      'currentLifecycleRevision must be a non-negative safe integer.',
    );
  }
  const evaluatorVersion = required(context.currentEvaluatorVersion, 'currentEvaluatorVersion');
  const currentSignals = normalizeSignals(context.currentSignals);
  const reasons: MemoryQuarantineRecommendationStaleReason[] = [];
  if (context.currentLifecycleRevision !== normalized.lifecycleRevision) reasons.push('lifecycle_revision_changed');
  if (evaluatorVersion !== normalized.evaluatorVersion) reasons.push('evaluator_version_changed');

  const currentId = deriveMemoryQuarantineRecommendationId(
    normalized.memoryId,
    context.currentLifecycleRevision,
    evaluatorVersion,
    currentSignals,
  );
  if (currentId !== normalized.recommendationId) reasons.push('signal_basis_changed');
  return reasons.length === 0
    ? { status: 'fresh', staleReasons: [] }
    : { status: 'stale', staleReasons: reasons };
}

export function verifyMemoryQuarantineRecommendationIntegrity(
  recommendation: StoredMemoryQuarantineRecommendation,
): boolean {
  if (!isRecord(recommendation) || typeof recommendation.integrityDigest !== 'string') return false;
  const { integrityDigest, ...base } = recommendation;
  return digest(base) === integrityDigest;
}

function normalizeRecommendation(
  recommendation: MemoryQuarantineRecommendation,
): MemoryQuarantineRecommendation {
  if (!isRecord(recommendation)) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'recommendation must be an object.');
  }
  const memoryId = required(recommendation.memoryId, 'memoryId');
  const evaluatorVersion = required(recommendation.evaluatorVersion, 'evaluatorVersion');
  const recommendationId = required(recommendation.recommendationId, 'recommendationId');
  if (!Number.isSafeInteger(recommendation.lifecycleRevision) || recommendation.lifecycleRevision < 0) {
    throw new MemoryQuarantineRecommendationConflictError(
      'INVALID_INPUT',
      'lifecycleRevision must be a non-negative safe integer.',
    );
  }
  if (typeof recommendation.recommendedAt !== 'string') {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'recommendedAt must be a string date-time.');
  }
  const recommendedAt = recommendation.recommendedAt.trim();
  if (!recommendedAt || Number.isNaN(Date.parse(recommendedAt))) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'recommendedAt must be a valid date-time.');
  }
  if (recommendation.status !== 'pending') {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'Only pending recommendations may be stored.');
  }
  if (!['recommend_quarantine', 'retain_quarantine'].includes(recommendation.decision)) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'Unsupported recommendation decision.');
  }
  const signals = normalizeSignals(recommendation.signals);
  if (signals.length === 0) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'A stored recommendation requires signals.');
  }
  const expectedId = deriveMemoryQuarantineRecommendationId(
    memoryId,
    recommendation.lifecycleRevision,
    evaluatorVersion,
    signals,
  );
  if (recommendationId !== expectedId) {
    throw new MemoryQuarantineRecommendationConflictError(
      'INVALID_IDENTITY',
      'recommendationId does not match the normalized recommendation basis.',
    );
  }
  return {
    recommendationId,
    memoryId,
    lifecycleRevision: recommendation.lifecycleRevision,
    evaluatorVersion,
    recommendedAt: recommendedAt as IsoDateTime,
    status: 'pending',
    decision: recommendation.decision,
    signals,
  };
}

const SIGNAL_ORDER: readonly MemoryQuarantineSignalType[] = [
  'unresolved_contradiction',
  'evidence_invalidation',
  'provenance_gap',
  'source_integrity_risk',
  'admission_inconsistency',
  'policy_violation',
  'supersession_conflict',
];
const EXPECTED_SEVERITY: Readonly<Record<MemoryQuarantineSignalType, MemoryQuarantineSignalSeverity>> = {
  unresolved_contradiction: 'high',
  evidence_invalidation: 'critical',
  provenance_gap: 'high',
  source_integrity_risk: 'critical',
  admission_inconsistency: 'critical',
  policy_violation: 'critical',
  supersession_conflict: 'high',
};

function normalizeSignals(signals: readonly MemoryQuarantineSignal[]): MemoryQuarantineSignal[] {
  if (!Array.isArray(signals)) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'signals must be an array.');
  }
  const byType = new Map<MemoryQuarantineSignalType, Set<string>>();
  for (const signal of signals) {
    if (!isRecord(signal)) {
      throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'quarantine signal must be an object.');
    }
    if (typeof signal.type !== 'string' || !SIGNAL_ORDER.includes(signal.type as MemoryQuarantineSignalType)) {
      throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'Unknown quarantine signal type.');
    }
    const type = signal.type as MemoryQuarantineSignalType;
    if (signal.severity !== EXPECTED_SEVERITY[type]) {
      throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'Quarantine signal severity does not match policy.');
    }
    if (!Array.isArray(signal.referenceIds)) {
      throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', 'signal referenceIds must be an array.');
    }
    const references = byType.get(type) ?? new Set<string>();
    for (const referenceId of signal.referenceIds) references.add(required(referenceId, 'signal reference id'));
    byType.set(type, references);
  }
  return SIGNAL_ORDER.flatMap((type) => {
    const referenceIds = [...(byType.get(type) ?? [])].sort();
    if (referenceIds.length === 0) return [];
    return [{ type, severity: EXPECTED_SEVERITY[type], referenceIds } satisfies MemoryQuarantineSignal];
  });
}

function recommendationBasis(recommendation: MemoryQuarantineRecommendation): unknown {
  const { recommendedAt: _recommendedAt, ...basis } = recommendation;
  return basis;
}

function cloneStored(value: StoredMemoryQuarantineRecommendation): StoredMemoryQuarantineRecommendation {
  return { ...value, signals: value.signals.map((signal) => ({ ...signal, referenceIds: [...signal.referenceIds] })) };
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', `${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new MemoryQuarantineRecommendationConflictError('INVALID_INPUT', `${field} is invalid.`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
