import { describe, expect, it } from 'vitest';
import { OrchestratorStateError, transitionTask, validateTaskContract } from './orchestrator-state.mjs';

function task(overrides = {}) {
  return {
    task_id: 'IBOS-0001',
    title: 'Phase A',
    objective: 'Add safe task state.',
    business_value: 'Protect internal execution.',
    status: 'pending',
    allowed_paths: ['.orchestrator/**', 'scripts/orchestrator-*'],
    forbidden_paths: ['.env', 'infra/production/**'],
    acceptance_criteria: ['Transitions are validated.'],
    required_commands: ['pnpm test'],
    requires_tests: true,
    requires_founder_approval: false,
    production_deploy_allowed: false,
    ...overrides,
  };
}

function expectStateError(action, code) {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestratorStateError);
    expect(error.code).toBe(code);
  }
}

describe('orchestrator task state', () => {
  it('accepts a bounded task contract and returns a defensive copy', () => {
    const source = task();
    const validated = validateTaskContract(source);
    validated.allowed_paths.push('unexpected/**');
    expect(source.allowed_paths).toEqual(['.orchestrator/**', 'scripts/orchestrator-*']);
  });

  it('supports the approved lifecycle', () => {
    const active = transitionTask(task(), 'active', [task()]);
    const review = transitionTask(active, 'review');
    const completed = transitionTask(review, 'completed');
    expect(completed.status).toBe('completed');
  });

  it('rejects invalid transitions', () => {
    expectStateError(() => transitionTask(task(), 'completed'), 'INVALID_TRANSITION');
  });

  it('enforces one active task', () => {
    expectStateError(
      () => transitionTask(task(), 'active', [task({ task_id: 'IBOS-0002', status: 'active' })]),
      'ACTIVE_TASK_EXISTS',
    );
  });

  it('requires the complete task set before activation', () => {
    expectStateError(() => transitionTask(task(), 'active'), 'TASK_SET_REQUIRED');
  });

  it('forbids production deployment in phase A', () => {
    expectStateError(
      () => validateTaskContract(task({ production_deploy_allowed: true })),
      'PRODUCTION_DEPLOY_FORBIDDEN',
    );
  });

  it('allows blocked work to return to pending', () => {
    const pending = transitionTask(task({ status: 'blocked' }), 'pending');
    expect(pending.status).toBe('pending');
  });
});
