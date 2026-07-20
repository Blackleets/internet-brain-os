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

describe('orchestrator task state', () => {
  it('accepts a bounded task contract and returns a defensive copy', () => {
    const source = task();
    const validated = validateTaskContract(source);
    validated.allowed_paths.push('unexpected/**');
    expect(source.allowed_paths).toEqual(['.orchestrator/**', 'scripts/orchestrator-*']);
  });

  it('supports the approved lifecycle', () => {
    const active = transitionTask(task(), 'active');
    const review = transitionTask(active, 'review');
    const completed = transitionTask(review, 'completed');
    expect(completed.status).toBe('completed');
  });

  it('rejects invalid transitions', () => {
    expect(() => transitionTask(task(), 'completed')).toThrow(OrchestratorStateError);
  });

  it('enforces one active task', () => {
    expect(() => transitionTask(task(), 'active', [task({ task_id: 'IBOS-0002', status: 'active' })]))
      .toThrowError(expect.objectContaining({ code: 'ACTIVE_TASK_EXISTS' }));
  });

  it('forbids production deployment in phase A', () => {
    expect(() => validateTaskContract(task({ production_deploy_allowed: true })))
      .toThrowError(expect.objectContaining({ code: 'PRODUCTION_DEPLOY_FORBIDDEN' }));
  });

  it('allows blocked work to return to pending', () => {
    const pending = transitionTask(task({ status: 'blocked' }), 'pending');
    expect(pending.status).toBe('pending');
  });
});
