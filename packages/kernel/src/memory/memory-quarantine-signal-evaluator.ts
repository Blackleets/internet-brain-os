import { createHash } from 'node:crypto';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  isTerminalMemoryAuthorityState,
  type MemoryAuthorityState,
} from './memory-authority-lifecycle';

export type MemoryQuarantineSignalType =
  | 'unresolved_contradiction'
  | 'evidence_invalidation'
  | 'provenance_gap'
  | 'source_integrity_risk'
  | 'admission_inconsistency'
  | 'policy_violation'
  | 'supersession_conflict';

export type MemoryQuarantineSignalSeverity = 'high' | 'critical';

export interface MemoryQuarantineReferenceSet {
  readonly unresolvedContradictionDecisionIds?: readonly string[];
  readonly invalidEvidenceIds?: readonly string[];
  readonly missingProvenanceReferenceIds?: readonly string[];
  readonly sourceIntegrityRiskRecordIds?: readonly string[];
  readonly admissionInconsistencyRecordIds?: readonly string[];
  readonly policyViolationRecordIds?: readonly string[];
  readonly supersessionConflictRecordIds?: readonly string[];
}

export interface MemoryQuarantineEvaluationInput {
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly state: MemoryAuthorityState;
  readonly evaluatorVersion: string;
  readonly evaluatedAt: IsoDateTime;
  readonly references: MemoryQuarantineReferenceSet;
}

export interface MemoryQuarantineSignal {
  readonly type: MemoryQuarantineSignalType;
  readonly severity: MemoryQuarantineSignalSeverity;
  readonly referenceIds: readonly string[];
}

export type MemoryQuarantineEvaluationDecision =
  | 'no_action'
  | 'recommend_quarantine'
  | 'retain_quarantine'
  | 'terminal_no_action';

export interface MemoryQuarantineRecommendation {
  readonly recommendationId: string;
  readonly memoryId: string;
  readonly lifecycleRevision: number;
  readonly evaluatorVersion: string;
  readonly recommendedAt: IsoDateTime;
  readonly status: 'pending';
  readonly decision: 'recommend_quarantine' | 'retain_quarantine';
  readonly signals: readonly MemoryQuarantineSignal[];
}

export interface MemoryQuarantineEvaluationResult {
  readonly decision: MemoryQuarantineEvaluationDecision;
  readonly signals: readonly MemoryQuarantineSignal[];
  readonly recommendation?: MemoryQuarantineRecommendation;
}

export type MemoryQuarantineEvaluationInputErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_MEMORY_ID'
  | 'INVALID_LIFECYCLE_REVISION'
  | 'INVALID_STATE'
  | 'INVALID_EVALUATOR_VERSION'
  | 'INVALID_EVALUATED_AT'
  | 'INVALID_REFERENCES'
  | 'INVALID_REFERENCE_ID';

export class MemoryQuarantineEvaluationInputError extends Error {
  readonly name = 'MemoryQuarantineEvaluationInputError';

  constructor(
    readonly code: MemoryQuarantineEvaluationInputErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const AUTHORITY_STATES: readonly MemoryAuthorityState[] = [
  'proposed',
  'quarantined',
  'admitted',
  'rejected',
  'superseded',
  'revoked',
];

const SIGNAL_DEFINITIONS: readonly {
  readonly type: MemoryQuarantineSignalType;
  readonly severity: MemoryQuarantineSignalSeverity;
  readonly select: (references: MemoryQuarantineReferenceSet) => readonly string[] | undefined;
}[] = [
  { type: 'unresolved_contradiction', severity: 'high', select: (references) => references.unresolvedContradictionDecisionIds },
  { type: 'evidence_invalidation', severity: 'critical', select: (references) => references.invalidEvidenceIds },
  { type: 'provenance_gap', severity: 'high', select: (references) => references.missingProvenanceReferenceIds },
  { type: 'source_integrity_risk', severity: 'critical', select: (references) => references.sourceIntegrityRiskRecordIds },
  { type: 'admission_inconsistency', severity: 'critical', select: (references) => references.admissionInconsistencyRecordIds },
  { type: 'policy_violation', severity: 'critical', select: (references) => references.policyViolationRecordIds },
  { type: 'supersession_conflict', severity: 'high', select: (references) => references.supersessionConflictRecordIds },
];

/** Converts persisted, inspectable risk references into a read-only recommendation. */
export function evaluateMemoryQuarantineSignals(
  input: MemoryQuarantineEvaluationInput,
): MemoryQuarantineEvaluationResult {
  if (!isRecord(input)) {
    throw new MemoryQuarantineEvaluationInputError('INVALID_INPUT', 'evaluation input must be an object.');
  }

  const memoryId = requireNonEmpty(input.memoryId, 'INVALID_MEMORY_ID', 'memoryId');
  const evaluatorVersion = requireNonEmpty(input.evaluatorVersion, 'INVALID_EVALUATOR_VERSION', 'evaluatorVersion');
  requireIsoDateTime(input.evaluatedAt);

  if (!Number.isSafeInteger(input.lifecycleRevision) || input.lifecycleRevision < 0) {
    throw new MemoryQuarantineEvaluationInputError(
      'INVALID_LIFECYCLE_REVISION',
      'lifecycleRevision must be a non-negative safe integer.',
    );
  }
  if (typeof input.state !== 'string' || !AUTHORITY_STATES.includes(input.state as MemoryAuthorityState)) {
    throw new MemoryQuarantineEvaluationInputError('INVALID_STATE', 'state must be a supported memory authority state.');
  }
  if (!isRecord(input.references)) {
    throw new MemoryQuarantineEvaluationInputError('INVALID_REFERENCES', 'references must be an object.');
  }

  const state = input.state as MemoryAuthorityState;
  const references = input.references as MemoryQuarantineReferenceSet;
  const signals = SIGNAL_DEFINITIONS.flatMap((definition) => {
    const referenceIds = normalizeReferenceIds(definition.select(references), definition.type);
    if (referenceIds.length === 0) return [];
    return [{ type: definition.type, severity: definition.severity, referenceIds } satisfies MemoryQuarantineSignal];
  });

  if (isTerminalMemoryAuthorityState(state)) {
    return { decision: 'terminal_no_action', signals: cloneSignals(signals) };
  }

  if (signals.length === 0) return { decision: 'no_action', signals: [] };

  const decision = state === 'quarantined' ? 'retain_quarantine' : 'recommend_quarantine';
  const recommendation: MemoryQuarantineRecommendation = {
    recommendationId: deriveMemoryQuarantineRecommendationId(
      memoryId,
      input.lifecycleRevision,
      evaluatorVersion,
      signals,
    ),
    memoryId,
    lifecycleRevision: input.lifecycleRevision,
    evaluatorVersion,
    recommendedAt: input.evaluatedAt,
    status: 'pending',
    decision,
    signals: cloneSignals(signals),
  };

  return { decision, signals: cloneSignals(signals), recommendation };
}

/** Stable identity for one memory revision + evaluator version + normalized signal basis. */
export function deriveMemoryQuarantineRecommendationId(
  memoryId: string,
  lifecycleRevision: number,
  evaluatorVersion: string,
  signals: readonly MemoryQuarantineSignal[],
): string {
  const canonicalSignals = signals.map((signal) => ({
    type: signal.type,
    severity: signal.severity,
    referenceIds: [...signal.referenceIds],
  }));
  const digest = createHash('sha256')
    .update(JSON.stringify({ memoryId, lifecycleRevision, evaluatorVersion, signals: canonicalSignals }))
    .digest('hex');
  return `memory-quarantine:${digest.slice(0, 32)}`;
}

function normalizeReferenceIds(
  values: readonly string[] | undefined,
  signalType: MemoryQuarantineSignalType,
): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new MemoryQuarantineEvaluationInputError(
      'INVALID_REFERENCE_ID',
      `Signal ${signalType} reference ids must be an array.`,
    );
  }
  const normalized = values.map((value) => {
    if (typeof value !== 'string') {
      throw new MemoryQuarantineEvaluationInputError(
        'INVALID_REFERENCE_ID',
        `Signal ${signalType} reference ids must be strings.`,
      );
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 240 || /[\u0000-\u001f\u007f]/.test(trimmed)) {
      throw new MemoryQuarantineEvaluationInputError(
        'INVALID_REFERENCE_ID',
        `Signal ${signalType} contains an invalid persisted reference id.`,
      );
    }
    return trimmed;
  });
  return [...new Set(normalized)].sort();
}

function requireNonEmpty(
  value: unknown,
  code: 'INVALID_MEMORY_ID' | 'INVALID_EVALUATOR_VERSION',
  field: string,
): string {
  if (typeof value !== 'string') {
    throw new MemoryQuarantineEvaluationInputError(code, `${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new MemoryQuarantineEvaluationInputError(code, `${field} is invalid.`);
  }
  return normalized;
}

function requireIsoDateTime(value: unknown): void {
  if (typeof value !== 'string') {
    throw new MemoryQuarantineEvaluationInputError(
      'INVALID_EVALUATED_AT',
      'evaluatedAt must be a string date-time.',
    );
  }
  const text = value.trim();
  if (!text || Number.isNaN(Date.parse(text))) {
    throw new MemoryQuarantineEvaluationInputError(
      'INVALID_EVALUATED_AT',
      'evaluatedAt must be a valid ISO date-time.',
    );
  }
}

function cloneSignals(signals: readonly MemoryQuarantineSignal[]): MemoryQuarantineSignal[] {
  return signals.map((signal) => ({ ...signal, referenceIds: [...signal.referenceIds] }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
