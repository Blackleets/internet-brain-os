import type {
  MemoryFailurePreventionRecommendation,
  MemoryQuarantineRecommendationFreshness,
  MemoryRecoveryReviewRecord,
  MemoryRecoveryReviewFreshnessReason,
  StoredMemoryQuarantineRecommendation,
} from '../memory';

export type ReplayLabMemorySafetyFreshness = 'current' | 'stale';
export type ReplayLabMemorySafetyBasis = 'persisted_record' | 'deterministic_projection' | 'human_decision';

export class ReplayLabMemorySafetyInputError extends Error {
  readonly name = 'ReplayLabMemorySafetyInputError';
  constructor(message: string) {
    super(message);
  }
}

export interface ReplayLabQuarantineSafetyInput {
  readonly record: StoredMemoryQuarantineRecommendation;
  readonly freshness: MemoryQuarantineRecommendationFreshness;
}

export interface ReplayLabRecoverySafetyInput {
  readonly record: MemoryRecoveryReviewRecord;
  readonly freshness: {
    readonly status: 'fresh' | 'stale';
    readonly staleReasons: readonly MemoryRecoveryReviewFreshnessReason[];
  };
}

export interface ReplayLabPreventionSafetyInput {
  readonly recommendation: MemoryFailurePreventionRecommendation;
  readonly stale: boolean;
}

export interface ReplayLabMemorySafetyViewInput {
  readonly memoryId: string;
  readonly quarantine: readonly ReplayLabQuarantineSafetyInput[];
  readonly recoveryReviews: readonly ReplayLabRecoverySafetyInput[];
  readonly prevention: readonly ReplayLabPreventionSafetyInput[];
}

export interface ReplayLabMemorySafetyReferenceView {
  readonly id: string;
  readonly kind: 'signal_reference' | 'failure' | 'persisted_reference' | 'replacement_candidate';
}

export interface ReplayLabMemoryQuarantineView {
  readonly kind: 'quarantine_recommendation';
  readonly id: string;
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly evaluatorVersion: string;
  readonly decision: StoredMemoryQuarantineRecommendation['decision'];
  readonly freshness: ReplayLabMemorySafetyFreshness;
  readonly staleReasons: readonly string[];
  readonly observedAt: string;
  readonly references: readonly ReplayLabMemorySafetyReferenceView[];
  readonly basis: 'persisted_record';
  readonly authority: 'read_only';
  readonly explanation: string;
}

export interface ReplayLabMemoryRecoveryView {
  readonly kind: 'recovery_review';
  readonly id: string;
  readonly memoryId: string;
  readonly terminalState: MemoryRecoveryReviewRecord['terminalState'];
  readonly terminalRevision: number;
  readonly outcome: MemoryRecoveryReviewRecord['outcome'];
  readonly reviewer: {
    readonly id: string;
    readonly type: MemoryRecoveryReviewRecord['reviewer']['type'];
  };
  readonly policyVersion: string;
  readonly freshness: ReplayLabMemorySafetyFreshness;
  readonly staleReasons: readonly string[];
  readonly observedAt: string;
  readonly replacementCandidateMemoryId?: string;
  readonly references: readonly ReplayLabMemorySafetyReferenceView[];
  readonly basis: 'human_decision';
  readonly authority: 'read_only';
  readonly explanation: string;
}

export interface ReplayLabMemoryPreventionView {
  readonly kind: 'prevention_recommendation';
  readonly id: string;
  readonly memoryId: string;
  readonly category: MemoryFailurePreventionRecommendation['category'];
  readonly policyVersion: string;
  readonly threshold: number;
  readonly windowMs: number;
  readonly freshness: ReplayLabMemorySafetyFreshness;
  readonly staleReasons: readonly string[];
  readonly observedAt: string;
  readonly references: readonly ReplayLabMemorySafetyReferenceView[];
  readonly basis: 'deterministic_projection';
  readonly authority: 'read_only';
  readonly explanation: string;
}

export interface ReplayLabMemorySafetyView {
  readonly memoryId: string;
  readonly quarantine: readonly ReplayLabMemoryQuarantineView[];
  readonly recoveryReviews: readonly ReplayLabMemoryRecoveryView[];
  readonly prevention: readonly ReplayLabMemoryPreventionView[];
  readonly warnings: readonly string[];
  readonly authorityBoundary: {
    readonly status: 'read_only';
    readonly explanation: string;
  };
}

/**
 * Projects Memory Safety state for operators. It accepts already-validated read
 * records plus freshness results and deliberately exposes no write command.
 */
export function buildReplayLabMemorySafetyView(
  input: ReplayLabMemorySafetyViewInput,
): ReplayLabMemorySafetyView {
  if (!isRecord(input)) {
    throw new ReplayLabMemorySafetyInputError('Memory Safety view input must be an object.');
  }
  const memoryId = required(input.memoryId, 'memoryId');
  const quarantineInput = requiredArray(input.quarantine, 'quarantine');
  const recoveryInput = requiredArray(input.recoveryReviews, 'recoveryReviews');
  const preventionInput = requiredArray(input.prevention, 'prevention');

  const quarantine = quarantineInput
    .map((entry, index) => requireQuarantineEntry(entry, index))
    .filter((entry) => entry.record.memoryId === memoryId)
    .map((entry): ReplayLabMemoryQuarantineView => ({
      kind: 'quarantine_recommendation',
      id: entry.record.recommendationId,
      memoryId,
      lifecycleRevision: entry.record.lifecycleRevision,
      evaluatorVersion: entry.record.evaluatorVersion,
      decision: entry.record.decision,
      freshness: entry.freshness.status === 'fresh' ? 'current' : 'stale',
      staleReasons: [...entry.freshness.staleReasons],
      observedAt: entry.record.recommendedAt,
      references: entry.record.signals.flatMap((signal) =>
        signal.referenceIds.map((id) => ({ id, kind: 'signal_reference' as const }))),
      basis: 'persisted_record',
      authority: 'read_only',
      explanation: entry.freshness.status === 'fresh'
        ? 'A persisted Kernel recommendation currently matches its lifecycle/evaluator/signal basis. It is not a memory transition.'
        : 'This persisted Kernel recommendation is historical because its governing lifecycle/evaluator/signal basis changed.',
    }))
    .sort(compareObserved);

  const recoveryReviews = recoveryInput
    .map((entry, index) => requireRecoveryEntry(entry, index))
    .filter((entry) => entry.record.terminalMemoryId === memoryId)
    .map((entry): ReplayLabMemoryRecoveryView => ({
      kind: 'recovery_review',
      id: entry.record.reviewId,
      memoryId,
      terminalState: entry.record.terminalState,
      terminalRevision: entry.record.terminalRevision,
      outcome: entry.record.outcome,
      reviewer: { ...entry.record.reviewer },
      policyVersion: entry.record.policyVersion,
      freshness: entry.freshness.status === 'fresh' ? 'current' : 'stale',
      staleReasons: [...entry.freshness.staleReasons],
      observedAt: entry.record.occurredAt,
      ...(entry.record.replacementCandidateMemoryId
        ? { replacementCandidateMemoryId: entry.record.replacementCandidateMemoryId }
        : {}),
      references: entry.record.replacementCandidateMemoryId
        ? [{ id: entry.record.replacementCandidateMemoryId, kind: 'replacement_candidate' as const }]
        : [],
      basis: 'human_decision',
      authority: 'read_only',
      explanation: entry.record.outcome === 'approved_new_candidate'
        ? 'A human/founder review authorized only a distinct new candidate identity; the terminal memory remains terminal.'
        : 'A human/founder review denied recovery. Replay Lab records the decision but cannot alter memory authority.',
    }))
    .sort(compareObserved);

  const prevention = preventionInput
    .map((entry, index) => requirePreventionEntry(entry, index))
    .filter((entry) => entry.recommendation.memoryId === memoryId)
    .map((entry): ReplayLabMemoryPreventionView => ({
      kind: 'prevention_recommendation',
      id: entry.recommendation.recommendationId,
      memoryId,
      category: entry.recommendation.category,
      policyVersion: entry.recommendation.policyVersion,
      threshold: entry.recommendation.threshold,
      windowMs: entry.recommendation.windowMs,
      freshness: entry.stale ? 'stale' : 'current',
      staleReasons: entry.stale ? ['prevention_basis_changed'] : [],
      observedAt: entry.recommendation.evaluatedAt,
      references: [
        ...entry.recommendation.failureIds.map((id) => ({ id, kind: 'failure' as const })),
        ...entry.recommendation.referenceIds.map((id) => ({ id, kind: 'persisted_reference' as const })),
      ],
      basis: 'deterministic_projection',
      authority: 'read_only',
      explanation: 'Repeated persisted failures crossed a deterministic policy threshold. This is guidance for review, not active policy or an inferred agent motive.',
    }))
    .sort(compareObserved);

  const staleCount = [...quarantine, ...recoveryReviews, ...prevention]
    .filter((item) => item.freshness === 'stale').length;
  const warnings = staleCount === 0
    ? []
    : [`${staleCount} memory-safety record(s) are historical/stale and must not be treated as current authorization.`];

  return {
    memoryId,
    quarantine,
    recoveryReviews,
    prevention,
    warnings,
    authorityBoundary: {
      status: 'read_only',
      explanation: 'Replay Lab projects persisted records, deterministic interpretations, and human decisions. It exposes no memory transition, approval, capability, or policy mutation command.',
    },
  };
}

function requireQuarantineEntry(value: unknown, index: number): ReplayLabQuarantineSafetyInput {
  if (!isRecord(value) || !isRecord(value.record) || !isRecord(value.freshness)) {
    throw new ReplayLabMemorySafetyInputError(`quarantine[${index}] must contain record and freshness objects.`);
  }
  if (typeof value.record.memoryId !== 'string' || !Array.isArray(value.record.signals)) {
    throw new ReplayLabMemorySafetyInputError(`quarantine[${index}] contains malformed persisted record data.`);
  }
  if (!['fresh', 'stale'].includes(String(value.freshness.status)) || !Array.isArray(value.freshness.staleReasons)) {
    throw new ReplayLabMemorySafetyInputError(`quarantine[${index}] contains malformed freshness data.`);
  }
  for (const signal of value.record.signals) {
    if (!isRecord(signal) || !Array.isArray(signal.referenceIds)) {
      throw new ReplayLabMemorySafetyInputError(`quarantine[${index}] contains malformed signal data.`);
    }
  }
  return value as unknown as ReplayLabQuarantineSafetyInput;
}

function requireRecoveryEntry(value: unknown, index: number): ReplayLabRecoverySafetyInput {
  if (!isRecord(value) || !isRecord(value.record) || !isRecord(value.freshness)) {
    throw new ReplayLabMemorySafetyInputError(`recoveryReviews[${index}] must contain record and freshness objects.`);
  }
  if (typeof value.record.terminalMemoryId !== 'string' || !isRecord(value.record.reviewer)) {
    throw new ReplayLabMemorySafetyInputError(`recoveryReviews[${index}] contains malformed persisted review data.`);
  }
  if (!['fresh', 'stale'].includes(String(value.freshness.status)) || !Array.isArray(value.freshness.staleReasons)) {
    throw new ReplayLabMemorySafetyInputError(`recoveryReviews[${index}] contains malformed freshness data.`);
  }
  return value as unknown as ReplayLabRecoverySafetyInput;
}

function requirePreventionEntry(value: unknown, index: number): ReplayLabPreventionSafetyInput {
  if (!isRecord(value) || !isRecord(value.recommendation) || typeof value.stale !== 'boolean') {
    throw new ReplayLabMemorySafetyInputError(`prevention[${index}] must contain a recommendation object and boolean stale flag.`);
  }
  if (typeof value.recommendation.memoryId !== 'string'
    || !Array.isArray(value.recommendation.failureIds)
    || !Array.isArray(value.recommendation.referenceIds)) {
    throw new ReplayLabMemorySafetyInputError(`prevention[${index}] contains malformed recommendation data.`);
  }
  return value as unknown as ReplayLabPreventionSafetyInput;
}

function compareObserved(left: { readonly observedAt: string; readonly id: string }, right: { readonly observedAt: string; readonly id: string }): number {
  return right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id);
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ReplayLabMemorySafetyInputError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ReplayLabMemorySafetyInputError(`${field} is invalid.`);
  }
  return normalized;
}

function requiredArray<T>(value: readonly T[] | unknown, field: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new ReplayLabMemorySafetyInputError(`${field} must be an array.`);
  }
  return value as readonly T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
