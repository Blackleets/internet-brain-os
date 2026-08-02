import { describe, expect, it } from 'vitest';
import {
  allowedMemoryAuthorityTransitions,
  isTerminalMemoryAuthorityState,
  validateMemoryAuthorityTransition,
  type MemoryAuthorityTransitionRequest,
} from './memory-authority-lifecycle';

const humanApproval = {
  decisionId: 'approval-1',
  approver: { id: 'operator-1', type: 'human' as const },
  outcome: 'approved' as const,
  policyVersion: 'memory-policy-v1',
};

function request(
  overrides: Partial<MemoryAuthorityTransitionRequest> = {},
): MemoryAuthorityTransitionRequest {
  return {
    from: 'proposed',
    to: 'admitted',
    executor: { id: 'kernel-1', type: 'kernel' },
    policyVersion: 'memory-policy-v1',
    approvalDecisions: [humanApproval],
    hasValidAdmissionRecord: true,
    hasResolvedContradictions: true,
    ...overrides,
  };
}

describe('memory authority lifecycle validator', () => {
  it('exposes immutable terminal states with no outgoing transitions', () => {
    for (const state of ['rejected', 'superseded', 'revoked'] as const) {
      expect(isTerminalMemoryAuthorityState(state)).toBe(true);
      expect(allowedMemoryAuthorityTransitions(state)).toEqual([]);
      expect(validateMemoryAuthorityTransition(request({ from: state, to: 'quarantined' }))).toMatchObject({
        ok: false,
        failureCode: 'INVALID_TRANSITION',
      });
    }
  });

  it('requires admission proof, resolved contradictions, and approval provenance', () => {
    expect(validateMemoryAuthorityTransition(request())).toEqual({ ok: true });
    expect(validateMemoryAuthorityTransition(request({ hasValidAdmissionRecord: false }))).toMatchObject({
      failureCode: 'MISSING_ADMISSION_PROOF',
    });
    expect(validateMemoryAuthorityTransition(request({ hasResolvedContradictions: false }))).toMatchObject({
      failureCode: 'UNRESOLVED_CONTRADICTIONS',
    });
    expect(validateMemoryAuthorityTransition(request({ approvalDecisions: [] }))).toMatchObject({
      failureCode: 'MISSING_APPROVAL',
    });
  });

  it('binds every approval to the exact governing policy version', () => {
    expect(validateMemoryAuthorityTransition(request({
      approvalDecisions: [{ ...humanApproval, policyVersion: 'memory-policy-v0' }],
    }))).toMatchObject({
      ok: false,
      failureCode: 'APPROVAL_POLICY_MISMATCH',
    });
  });

  it('requires founder approval for high-impact transitions', () => {
    expect(validateMemoryAuthorityTransition(request({ highImpact: true }))).toMatchObject({
      failureCode: 'FOUNDER_APPROVAL_REQUIRED',
    });

    expect(validateMemoryAuthorityTransition(request({
      highImpact: true,
      approvalDecisions: [{
        ...humanApproval,
        decisionId: 'founder-approval',
        approver: { id: 'founder-1', type: 'founder' },
      }],
    }))).toEqual({ ok: true });
  });

  it('allows automatic quarantine only with a persisted signal', () => {
    const quarantine = request({
      from: 'admitted',
      to: 'quarantined',
      approvalDecisions: [],
      hasPersistedQuarantineSignal: true,
    });

    expect(validateMemoryAuthorityTransition(quarantine)).toEqual({ ok: true });
    expect(validateMemoryAuthorityTransition({
      ...quarantine,
      hasPersistedQuarantineSignal: false,
    })).toMatchObject({ failureCode: 'MISSING_QUARANTINE_SIGNAL' });
  });

  it('requires an already admitted linked replacement for supersession', () => {
    const supersede = request({
      from: 'admitted',
      to: 'superseded',
      replacementMemoryId: 'memory-2',
      replacementIsAdmitted: true,
    });

    expect(validateMemoryAuthorityTransition(supersede)).toEqual({ ok: true });
    expect(validateMemoryAuthorityTransition({ ...supersede, replacementMemoryId: '' })).toMatchObject({
      failureCode: 'MISSING_REPLACEMENT',
    });
    expect(validateMemoryAuthorityTransition({ ...supersede, replacementIsAdmitted: false })).toMatchObject({
      failureCode: 'REPLACEMENT_NOT_ADMITTED',
    });
  });

  it('allows Kernel rejection only for deterministic hard failures', () => {
    const rejection = request({
      from: 'proposed',
      to: 'rejected',
      approvalDecisions: [],
      deterministicHardFailure: true,
    });

    expect(validateMemoryAuthorityTransition(rejection)).toEqual({ ok: true });
    expect(validateMemoryAuthorityTransition({ ...rejection, deterministicHardFailure: false })).toMatchObject({
      failureCode: 'MISSING_APPROVAL',
    });
  });

  it('prevents recovery actors from executing normal lifecycle transitions', () => {
    expect(validateMemoryAuthorityTransition(request({
      executor: { id: 'recovery-1', type: 'recovery' },
    }))).toMatchObject({
      ok: false,
      failureCode: 'INVALID_EXECUTOR',
    });
  });

  it('returns defensive copies of allowed transitions', () => {
    const transitions = allowedMemoryAuthorityTransitions('proposed') as string[];
    transitions.push('revoked');
    expect(allowedMemoryAuthorityTransitions('proposed')).toEqual(['quarantined', 'admitted', 'rejected']);
  });
});
