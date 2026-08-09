import { createHash } from 'node:crypto';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  isTerminalMemoryAuthorityState,
  type MemoryAuthorityActor,
  type MemoryAuthorityActorType,
  type MemoryAuthorityState,
} from './memory-authority-lifecycle';

export type TerminalMemoryAuthorityState = Extract<MemoryAuthorityState, 'rejected' | 'superseded' | 'revoked'>;
export type MemoryRecoveryReviewOutcome = 'approved_new_candidate' | 'denied';

export interface MemoryRecoveryReviewRequest {
  readonly terminalMemoryId: string;
  readonly terminalState: TerminalMemoryAuthorityState;
  readonly terminalRevision: number;
  readonly requestId: string;
  readonly requestedBy: MemoryAuthorityActor;
  readonly reviewer: MemoryAuthorityActor;
  readonly policyVersion: string;
  readonly requiresFounderApproval?: boolean;
  readonly outcome: MemoryRecoveryReviewOutcome;
  readonly replacementCandidateMemoryId?: string;
  readonly reason: string;
  readonly occurredAt: IsoDateTime;
}

export interface MemoryRecoveryReviewRecord extends MemoryRecoveryReviewRequest {
  readonly reviewId: string;
  readonly payloadDigest: string;
  readonly integrityDigest: string;
}

export type MemoryRecoveryReviewAppendResult =
  | { readonly kind: 'appended'; readonly review: MemoryRecoveryReviewRecord }
  | { readonly kind: 'replayed'; readonly review: MemoryRecoveryReviewRecord };

export class MemoryRecoveryReviewConflictError extends Error {
  readonly name = 'MemoryRecoveryReviewConflictError';
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'NON_TERMINAL_MEMORY'
      | 'UNAUTHORIZED_REVIEWER'
      | 'FOUNDER_APPROVAL_REQUIRED'
      | 'MISSING_NEW_CANDIDATE'
      | 'INVALID_NEW_CANDIDATE'
      | 'ALTERED_REPLAY'
      | 'INVALID_INTEGRITY',
    message: string,
  ) {
    super(message);
  }
}

export interface MemoryRecoveryReviewRepository {
  append(request: MemoryRecoveryReviewRequest): MemoryRecoveryReviewAppendResult;
  list(terminalMemoryId?: string): readonly MemoryRecoveryReviewRecord[];
  findByRequestId(requestId: string): MemoryRecoveryReviewRecord | undefined;
  getById(reviewId: string): MemoryRecoveryReviewRecord | undefined;
}

export class InMemoryMemoryRecoveryReviewRepository implements MemoryRecoveryReviewRepository {
  private readonly byRequest = new Map<string, MemoryRecoveryReviewRecord>();
  private readonly byId = new Map<string, MemoryRecoveryReviewRecord>();
  private readonly idsByMemory = new Map<string, string[]>();

  append(request: MemoryRecoveryReviewRequest): MemoryRecoveryReviewAppendResult {
    const normalized = normalizeRequest(request);
    const payloadDigest = digest(normalized);
    const existing = this.byRequest.get(normalized.requestId);
    if (existing) {
      if (existing.payloadDigest !== payloadDigest) {
        throw new MemoryRecoveryReviewConflictError(
          'ALTERED_REPLAY',
          'The recovery requestId is already bound to a different normalized review payload.',
        );
      }
      return { kind: 'replayed', review: cloneRecord(existing) };
    }

    const reviewId = `memory-recovery-review:${payloadDigest.slice(0, 32)}`;
    const base = { ...normalized, reviewId, payloadDigest };
    const integrityDigest = digest(base);
    const record: MemoryRecoveryReviewRecord = { ...base, integrityDigest };
    const stored = cloneRecord(record);
    this.byRequest.set(record.requestId, stored);
    this.byId.set(record.reviewId, stored);
    const ids = this.idsByMemory.get(record.terminalMemoryId) ?? [];
    this.idsByMemory.set(record.terminalMemoryId, [...ids, record.reviewId]);
    return { kind: 'appended', review: cloneRecord(stored) };
  }

  list(terminalMemoryId?: string): readonly MemoryRecoveryReviewRecord[] {
    if (terminalMemoryId === undefined) return [...this.byId.values()].map(cloneRecord);
    const id = required(terminalMemoryId, 'terminalMemoryId');
    return (this.idsByMemory.get(id) ?? [])
      .map((reviewId) => this.byId.get(reviewId))
      .filter((entry): entry is MemoryRecoveryReviewRecord => Boolean(entry))
      .map(cloneRecord);
  }

  findByRequestId(requestId: string): MemoryRecoveryReviewRecord | undefined {
    const record = this.byRequest.get(required(requestId, 'requestId'));
    return record ? cloneRecord(record) : undefined;
  }

  getById(reviewId: string): MemoryRecoveryReviewRecord | undefined {
    const record = this.byId.get(required(reviewId, 'reviewId'));
    return record ? cloneRecord(record) : undefined;
  }
}

export type MemoryRecoveryReviewFreshnessReason =
  | 'terminal_state_changed'
  | 'terminal_revision_changed'
  | 'policy_version_changed';

const AUTHORITY_STATES: readonly MemoryAuthorityState[] = [
  'proposed',
  'quarantined',
  'admitted',
  'rejected',
  'superseded',
  'revoked',
];

export function assessMemoryRecoveryReviewFreshness(
  record: MemoryRecoveryReviewRecord,
  current: {
    readonly terminalState: MemoryAuthorityState;
    readonly terminalRevision: number;
    readonly policyVersion: string;
  },
): { readonly status: 'fresh' | 'stale'; readonly staleReasons: readonly MemoryRecoveryReviewFreshnessReason[] } {
  if (!isRecord(record) || !isRecord(current)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'record and current freshness context must be objects.');
  }
  if (!Number.isSafeInteger(current.terminalRevision) || current.terminalRevision < 0) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'terminalRevision must be a non-negative safe integer.');
  }
  if (typeof current.terminalState !== 'string' || !AUTHORITY_STATES.includes(current.terminalState as MemoryAuthorityState)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'terminalState must be a supported memory authority state.');
  }
  const policyVersion = required(current.policyVersion, 'policyVersion');
  const reasons: MemoryRecoveryReviewFreshnessReason[] = [];
  if (current.terminalState !== record.terminalState) reasons.push('terminal_state_changed');
  if (current.terminalRevision !== record.terminalRevision) reasons.push('terminal_revision_changed');
  if (policyVersion !== record.policyVersion) reasons.push('policy_version_changed');
  return { status: reasons.length === 0 ? 'fresh' : 'stale', staleReasons: reasons };
}

export function verifyMemoryRecoveryReviewIntegrity(record: MemoryRecoveryReviewRecord): boolean {
  if (!isRecord(record) || typeof record.integrityDigest !== 'string') return false;
  const { integrityDigest, ...base } = record;
  return digest(base) === integrityDigest;
}

function normalizeRequest(request: MemoryRecoveryReviewRequest): MemoryRecoveryReviewRequest {
  if (!isRecord(request)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'recovery review request must be an object.');
  }
  const terminalMemoryId = required(request.terminalMemoryId, 'terminalMemoryId');
  if (typeof request.terminalState !== 'string' || !isTerminalMemoryAuthorityState(request.terminalState as MemoryAuthorityState)) {
    throw new MemoryRecoveryReviewConflictError('NON_TERMINAL_MEMORY', 'Recovery review is only valid for terminal memory.');
  }
  const terminalState = request.terminalState as TerminalMemoryAuthorityState;
  if (!Number.isSafeInteger(request.terminalRevision) || request.terminalRevision < 0) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'terminalRevision must be a non-negative safe integer.');
  }
  if (typeof request.outcome !== 'string' || !['approved_new_candidate', 'denied'].includes(request.outcome)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'Unsupported recovery review outcome.');
  }
  const outcome = request.outcome as MemoryRecoveryReviewOutcome;
  const requestedBy = normalizeActor(request.requestedBy as MemoryAuthorityActor, 'requestedBy');
  const reviewer = normalizeActor(request.reviewer as MemoryAuthorityActor, 'reviewer');
  if (!['human', 'founder'].includes(reviewer.type)) {
    throw new MemoryRecoveryReviewConflictError(
      'UNAUTHORIZED_REVIEWER',
      'Recovery review decisions require a human or founder reviewer.',
    );
  }
  if (request.requiresFounderApproval !== undefined && typeof request.requiresFounderApproval !== 'boolean') {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'requiresFounderApproval must be boolean when supplied.');
  }
  if (request.requiresFounderApproval === true && reviewer.type !== 'founder') {
    throw new MemoryRecoveryReviewConflictError(
      'FOUNDER_APPROVAL_REQUIRED',
      'This recovery review requires founder approval.',
    );
  }
  const policyVersion = required(request.policyVersion, 'policyVersion');
  const requestId = required(request.requestId, 'requestId');
  const reason = required(request.reason, 'reason');
  const occurredAt = requireDateTime(request.occurredAt, 'occurredAt');

  let replacementCandidateMemoryId: string | undefined;
  if (request.replacementCandidateMemoryId !== undefined) {
    replacementCandidateMemoryId = required(request.replacementCandidateMemoryId, 'replacementCandidateMemoryId');
  }
  if (outcome === 'approved_new_candidate') {
    if (!replacementCandidateMemoryId) {
      throw new MemoryRecoveryReviewConflictError(
        'MISSING_NEW_CANDIDATE',
        'Approved recovery review requires a new linked candidate memory id.',
      );
    }
    if (replacementCandidateMemoryId === terminalMemoryId) {
      throw new MemoryRecoveryReviewConflictError(
        'INVALID_NEW_CANDIDATE',
        'Recovery cannot reopen the terminal memory id; a distinct candidate id is required.',
      );
    }
  } else {
    replacementCandidateMemoryId = undefined;
  }

  return {
    terminalMemoryId,
    terminalState,
    terminalRevision: request.terminalRevision as number,
    requestId,
    requestedBy,
    reviewer,
    policyVersion,
    requiresFounderApproval: request.requiresFounderApproval === true,
    outcome,
    replacementCandidateMemoryId,
    reason,
    occurredAt: occurredAt as IsoDateTime,
  };
}

const ACTOR_TYPES: readonly MemoryAuthorityActorType[] = ['kernel', 'human', 'founder', 'recovery'];

function normalizeActor(actor: MemoryAuthorityActor, field: string): MemoryAuthorityActor {
  if (!isRecord(actor) || typeof actor.type !== 'string' || !ACTOR_TYPES.includes(actor.type as MemoryAuthorityActorType)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', `${field}.type is invalid.`);
  }
  return { id: required(actor.id, `${field}.id`), type: actor.type as MemoryAuthorityActorType };
}

function cloneRecord(record: MemoryRecoveryReviewRecord): MemoryRecoveryReviewRecord {
  return {
    ...record,
    requestedBy: { ...record.requestedBy },
    reviewer: { ...record.reviewer },
  };
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', `${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 500 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', `${field} is invalid.`);
  }
  return normalized;
}

function requireDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', `${field} must be a string date-time.`);
  }
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', `${field} must be a valid date-time.`);
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
