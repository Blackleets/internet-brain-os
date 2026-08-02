export type MemoryAuthorityState =
  | 'proposed'
  | 'quarantined'
  | 'admitted'
  | 'rejected'
  | 'superseded'
  | 'revoked';

export type MemoryAuthorityActorType = 'kernel' | 'human' | 'founder' | 'recovery';

export interface MemoryAuthorityActor {
  readonly id: string;
  readonly type: MemoryAuthorityActorType;
}

export interface MemoryApprovalDecision {
  readonly decisionId: string;
  readonly approver: MemoryAuthorityActor;
  readonly outcome: 'approved' | 'rejected';
  readonly policyVersion: string;
}

export interface MemoryAuthorityTransitionRequest {
  readonly from: MemoryAuthorityState;
  readonly to: MemoryAuthorityState;
  readonly executor: MemoryAuthorityActor;
  readonly policyVersion: string;
  readonly approvalDecisions?: readonly MemoryApprovalDecision[];
  readonly hasPersistedQuarantineSignal?: boolean;
  readonly hasValidAdmissionRecord?: boolean;
  readonly hasResolvedContradictions?: boolean;
  readonly replacementMemoryId?: string;
  readonly replacementIsAdmitted?: boolean;
  readonly deterministicHardFailure?: boolean;
  readonly highImpact?: boolean;
}

export type MemoryAuthorityTransitionFailureCode =
  | 'INVALID_TRANSITION'
  | 'INVALID_EXECUTOR'
  | 'MISSING_POLICY_VERSION'
  | 'MISSING_APPROVAL'
  | 'APPROVAL_POLICY_MISMATCH'
  | 'FOUNDER_APPROVAL_REQUIRED'
  | 'MISSING_QUARANTINE_SIGNAL'
  | 'MISSING_ADMISSION_PROOF'
  | 'UNRESOLVED_CONTRADICTIONS'
  | 'MISSING_REPLACEMENT'
  | 'REPLACEMENT_NOT_ADMITTED';

export interface MemoryAuthorityTransitionValidation {
  readonly ok: boolean;
  readonly failureCode?: MemoryAuthorityTransitionFailureCode;
  readonly message?: string;
}

const TERMINAL_STATES = new Set<MemoryAuthorityState>(['rejected', 'superseded', 'revoked']);

const VALID_TRANSITIONS: Readonly<Record<MemoryAuthorityState, readonly MemoryAuthorityState[]>> = {
  proposed: ['quarantined', 'admitted', 'rejected'],
  quarantined: ['proposed', 'admitted', 'rejected'],
  admitted: ['quarantined', 'superseded', 'revoked'],
  rejected: [],
  superseded: [],
  revoked: [],
};

export function allowedMemoryAuthorityTransitions(state: MemoryAuthorityState): readonly MemoryAuthorityState[] {
  return [...VALID_TRANSITIONS[state]];
}

export function isTerminalMemoryAuthorityState(state: MemoryAuthorityState): boolean {
  return TERMINAL_STATES.has(state);
}

export function validateMemoryAuthorityTransition(
  request: MemoryAuthorityTransitionRequest,
): MemoryAuthorityTransitionValidation {
  if (!request.policyVersion.trim()) {
    return failure('MISSING_POLICY_VERSION', 'A non-empty governing policy version is required.');
  }

  if (!VALID_TRANSITIONS[request.from].includes(request.to)) {
    return failure(
      'INVALID_TRANSITION',
      `Transition ${request.from} -> ${request.to} is not allowed.`,
    );
  }

  if (request.executor.type === 'recovery') {
    return failure(
      'INVALID_EXECUTOR',
      'Recovery actors may open recovery reviews but cannot execute normal lifecycle transitions.',
    );
  }

  if (request.to === 'quarantined') {
    if (!request.hasPersistedQuarantineSignal) {
      return failure('MISSING_QUARANTINE_SIGNAL', 'Quarantine requires a persisted deterministic signal.');
    }
    if (!['kernel', 'human', 'founder'].includes(request.executor.type)) {
      return failure('INVALID_EXECUTOR', 'The executor is not authorized to quarantine memory.');
    }
    return success();
  }

  if (request.to === 'admitted') {
    if (!request.hasValidAdmissionRecord) {
      return failure('MISSING_ADMISSION_PROOF', 'Admission requires a valid persisted admission record.');
    }
    if (!request.hasResolvedContradictions) {
      return failure('UNRESOLVED_CONTRADICTIONS', 'Admission requires resolved contradiction decisions.');
    }
    return validateApproval(request, request.highImpact === true);
  }

  if (request.to === 'superseded') {
    if (!request.replacementMemoryId?.trim()) {
      return failure('MISSING_REPLACEMENT', 'Supersession requires an explicitly linked replacement memory.');
    }
    if (!request.replacementIsAdmitted) {
      return failure('REPLACEMENT_NOT_ADMITTED', 'The replacement memory must already be admitted.');
    }
    return validateApproval(request, request.highImpact === true);
  }

  if (request.to === 'revoked') {
    return validateApproval(request, request.highImpact === true);
  }

  if (request.to === 'proposed') {
    return validateApproval(request, false);
  }

  if (request.to === 'rejected') {
    if (request.executor.type === 'kernel' && request.deterministicHardFailure === true) {
      return success();
    }
    return validateApproval(request, request.highImpact === true);
  }

  return failure('INVALID_TRANSITION', 'Unsupported lifecycle transition.');
}

function validateApproval(
  request: MemoryAuthorityTransitionRequest,
  founderRequired: boolean,
): MemoryAuthorityTransitionValidation {
  const approvals = request.approvalDecisions ?? [];
  const matching = approvals.filter(
    (decision) => decision.outcome === 'approved' && decision.policyVersion === request.policyVersion,
  );

  if (approvals.some((decision) => decision.policyVersion !== request.policyVersion)) {
    return failure(
      'APPROVAL_POLICY_MISMATCH',
      'Every supplied approval decision must bind to the governing policy version.',
    );
  }

  if (matching.length === 0) {
    return failure('MISSING_APPROVAL', 'This transition requires an immutable approval decision.');
  }

  if (founderRequired && !matching.some((decision) => decision.approver.type === 'founder')) {
    return failure('FOUNDER_APPROVAL_REQUIRED', 'High-impact transitions require founder approval.');
  }

  if (!matching.some((decision) => ['human', 'founder'].includes(decision.approver.type))) {
    return failure('MISSING_APPROVAL', 'Approval must come from a human operator or founder.');
  }

  if (!['kernel', 'human', 'founder'].includes(request.executor.type)) {
    return failure('INVALID_EXECUTOR', 'The executor is not authorized for this lifecycle transition.');
  }

  return success();
}

function success(): MemoryAuthorityTransitionValidation {
  return { ok: true };
}

function failure(
  failureCode: MemoryAuthorityTransitionFailureCode,
  message: string,
): MemoryAuthorityTransitionValidation {
  return { ok: false, failureCode, message };
}
