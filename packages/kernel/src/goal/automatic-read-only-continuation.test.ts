import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_READ_ONLY_POLICY_VERSION,
  GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
  evaluateAutomaticReadOnlyContinuation,
  type AutomaticReadOnlyContinuationInput,
} from './automatic-read-only-continuation';

function input(overrides: Record<string, unknown> = {}): AutomaticReadOnlyContinuationInput {
  const base: AutomaticReadOnlyContinuationInput = {
    goal: { id: 'goal:1', revision: 3, status: 'active', approvalPolicy: 'none' },
    authorization: {
      schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
      id: 'goal-auth:1',
      goalId: 'goal:1',
      goalRevision: 3,
      decision: 'approved',
      scope: 'read_only_continuation',
      actorType: 'human',
      decidedBy: 'user:1',
      decidedAt: '2026-08-09T19:40:00.000Z',
    },
    capability: {
      definition: {
        id: 'web.search',
        version: '1',
        provider: 'public-web',
        riskLevel: 'r0_observe',
        consentPolicy: 'none',
        allowedDataScopes: ['public_web'],
        credentialScopes: [],
        health: 'available',
      },
      requiresConsent: false,
    },
  };
  return { ...base, ...overrides } as AutomaticReadOnlyContinuationInput;
}

function withGoal(patch: Partial<AutomaticReadOnlyContinuationInput['goal']>) {
  return input({ goal: { ...input().goal, ...patch } });
}

function withAuthorization(patch: Partial<NonNullable<AutomaticReadOnlyContinuationInput['authorization']>>) {
  return input({ authorization: { ...input().authorization!, ...patch } });
}

function withCapability(patch: Partial<AutomaticReadOnlyContinuationInput['capability']['definition']>, requiresConsent?: boolean) {
  const current = input().capability;
  const definition = { ...current.definition, ...patch };
  return input({
    capability: {
      definition,
      requiresConsent: requiresConsent ?? definition.consentPolicy !== 'none',
    },
  });
}

describe('automatic read-only continuation policy', () => {
  it('allows revision-bound R0 continuation after explicit human Goal authorization', () => {
    expect(evaluateAutomaticReadOnlyContinuation(input())).toEqual({
      policyVersion: AUTOMATIC_READ_ONLY_POLICY_VERSION,
      allowed: true,
      reason: 'eligible',
      goalId: 'goal:1',
      capabilityId: 'web.search',
      authorizationRef: 'goal-auth:1',
    });
  });

  it('allows policy-level consent only when the matching Goal authorization receipt already exists', () => {
    const result = evaluateAutomaticReadOnlyContinuation(withCapability({ consentPolicy: 'policy' }, true));
    expect(result).toMatchObject({ allowed: true, reason: 'eligible' });
  });

  it('never treats an active Goal as authorization by itself', () => {
    expect(evaluateAutomaticReadOnlyContinuation(input({ authorization: undefined }))).toMatchObject({
      allowed: false,
      reason: 'authorization_missing',
    });
  });

  it.each(['paused', 'completed', 'failed', 'cancelled'] as const)('blocks automatic continuation when Goal is %s', (status) => {
    expect(evaluateAutomaticReadOnlyContinuation(withGoal({ status }))).toMatchObject({ allowed: false, reason: 'goal_not_active' });
  });

  it('rejects stale authorization after the Goal revision changes', () => {
    expect(evaluateAutomaticReadOnlyContinuation(withGoal({ revision: 4 }))).toMatchObject({
      allowed: false,
      reason: 'authorization_revision_mismatch',
    });
  });

  it('rejects a receipt bound to another Goal', () => {
    expect(evaluateAutomaticReadOnlyContinuation(withAuthorization({ goalId: 'goal:other' }))).toMatchObject({
      allowed: false,
      reason: 'authorization_goal_mismatch',
    });
  });

  it('rejects rejected, automated, and single-action receipts', () => {
    expect(evaluateAutomaticReadOnlyContinuation(withAuthorization({ decision: 'rejected' }))).toMatchObject({ allowed: false, reason: 'authorization_rejected' });
    expect(evaluateAutomaticReadOnlyContinuation(withAuthorization({ actorType: 'agent' }))).toMatchObject({ allowed: false, reason: 'authorization_actor_not_human' });
    expect(evaluateAutomaticReadOnlyContinuation(withAuthorization({ scope: 'single_action' }))).toMatchObject({ allowed: false, reason: 'authorization_scope_mismatch' });
  });

  it.each(['r1_reversible', 'r2_external', 'r3_irreversible'] as const)('never auto-continues %s capabilities', (riskLevel) => {
    expect(evaluateAutomaticReadOnlyContinuation(withCapability({ riskLevel }))).toMatchObject({
      allowed: false,
      reason: 'capability_not_read_only',
    });
  });

  it('requires a fresh prompt for capabilities whose consent policy is always', () => {
    expect(evaluateAutomaticReadOnlyContinuation(withCapability({ consentPolicy: 'always' }, true))).toMatchObject({
      allowed: false,
      reason: 'capability_requires_fresh_consent',
    });
  });

  it.each(['all_actions', 'custom'] as const)('respects Goal approval policy %s even with a valid read-only receipt', (approvalPolicy) => {
    expect(evaluateAutomaticReadOnlyContinuation(withGoal({ approvalPolicy }))).toMatchObject({
      allowed: false,
      reason: 'goal_requires_fresh_approval',
    });
  });

  it('fails closed for unavailable capability state and contradictory capability envelopes', () => {
    expect(evaluateAutomaticReadOnlyContinuation(withCapability({ health: 'unavailable' }))).toMatchObject({
      allowed: false,
      reason: 'capability_unavailable',
    });
    const contradictory = input({
      capability: { ...input().capability, requiresConsent: true },
    });
    expect(evaluateAutomaticReadOnlyContinuation(contradictory)).toMatchObject({ allowed: false, reason: 'invalid_input' });
  });

  it.each([null, [], 'goal', 42, { goal: null }, { capability: null }])('fails closed on malformed runtime input %#', (value) => {
    expect(() => evaluateAutomaticReadOnlyContinuation(value)).not.toThrow();
    expect(evaluateAutomaticReadOnlyContinuation(value)).toEqual({
      policyVersion: AUTOMATIC_READ_ONLY_POLICY_VERSION,
      allowed: false,
      reason: 'invalid_input',
    });
  });

  it('returns authority references but never private Goal copy or executable capability grants', () => {
    const value = JSON.stringify(evaluateAutomaticReadOnlyContinuation(input()));
    expect(value).toContain('goal-auth:1');
    expect(value).not.toContain('desiredOutcome');
    expect(value).not.toContain('title');
    expect(value).not.toContain('approvedCapabilities');
  });
});
