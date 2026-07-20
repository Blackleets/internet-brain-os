import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OrchestratorStore, OrchestratorStoreError } from './orchestrator-store.mjs';

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function store() {
  const root = await mkdtemp(join(tmpdir(), 'ibos-orchestrator-'));
  roots.push(root);
  return new OrchestratorStore(root);
}

function task(id = 'IBOS-1000', overrides = {}) {
  return {
    task_id: id, title: 'Filesystem CLI', objective: 'Persist one bounded task.', business_value: 'Make orchestration usable.',
    status: 'pending', allowed_paths: ['scripts/orchestrator-*'], forbidden_paths: ['.env'],
    acceptance_criteria: ['Lifecycle is durable.'], required_commands: ['pnpm test'],
    requires_tests: true, requires_founder_approval: false, production_deploy_allowed: false, ...overrides,
  };
}

function report(id = 'IBOS-1000', overrides = {}) {
  return {
    task_id: id, status: 'completed', summary: 'Done.', branch: 'phase/d-orchestrator-filesystem-cli', commit: 'abcdef1',
    files_changed: ['scripts/orchestrator-store.mjs'], commands_run: ['pnpm test'], test_results: ['passed'],
    acceptance_criteria_results: ['Lifecycle is durable.'], risks: [], deviations: [], recommended_next_step: 'Review.', ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    branch: 'phase/d-orchestrator-filesystem-cli', baseBranch: 'main', headSha: 'abcdef1',
    changedFiles: ['scripts/orchestrator-store.mjs'], checks: [{ name: 'pnpm test', status: 'success' }], dirty: false, ...overrides,
  };
}

async function expectCode(action, code) {
  await expect(action()).rejects.toMatchObject({ code });
}

describe('filesystem orchestrator store', () => {
  it('persists the full pending to completed lifecycle', async () => {
    const subject = await store();
    await subject.create(task());
    expect((await subject.activate('IBOS-1000')).status).toBe('active');
    expect((await subject.report('IBOS-1000', report())).task.status).toBe('review');
    expect((await subject.approve('IBOS-1000', evidence())).decision).toBe('APPROVED');
    const inspected = await subject.inspect('IBOS-1000');
    expect(inspected.task.status).toBe('completed');
    expect(inspected.hermes_report.status).toBe('completed');
    expect(inspected.cto_report.decision).toBe('APPROVED');
  });

  it('enforces one active task across durable state', async () => {
    const subject = await store();
    await subject.create(task('IBOS-1000'));
    await subject.create(task('IBOS-1001'));
    await subject.activate('IBOS-1000');
    await expect(subject.activate('IBOS-1001')).rejects.toMatchObject({ code: 'ACTIVE_TASK_EXISTS' });
  });

  it('serializes concurrent mutations so only one task becomes active', async () => {
    const subject = await store();
    await subject.create(task('IBOS-1000'));
    await subject.create(task('IBOS-1001'));
    const results = await Promise.allSettled([subject.activate('IBOS-1000'), subject.activate('IBOS-1001')]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect((await subject.status()).counts.active).toBe(1);
  });

  it('returns corrections without completing a task when Git evidence fails', async () => {
    const subject = await store();
    await subject.create(task());
    await subject.activate('IBOS-1000');
    await subject.report('IBOS-1000', report());
    const decision = await subject.approve('IBOS-1000', evidence({ dirty: true }));
    expect(decision.decision).toBe('CORRECTIONS_REQUIRED');
    expect((await subject.inspect('IBOS-1000')).task.status).toBe('review');
  });

  it('requires explicit founder approval when the contract says so', async () => {
    const subject = await store();
    await subject.create(task('IBOS-1000', { requires_founder_approval: true }));
    await subject.activate('IBOS-1000');
    await subject.report('IBOS-1000', report());
    await expectCode(() => subject.approve('IBOS-1000', evidence()), 'FOUNDER_APPROVAL_REQUIRED');
    expect((await subject.approve('IBOS-1000', evidence(), { founderApproved: true })).decision).toBe('APPROVED');
  });

  it('moves rejected review work back to active and records the reason', async () => {
    const subject = await store();
    await subject.create(task());
    await subject.activate('IBOS-1000');
    await subject.report('IBOS-1000', report());
    await subject.reject('IBOS-1000', 'Add missing regression coverage.');
    const inspected = await subject.inspect('IBOS-1000');
    expect(inspected.task.status).toBe('active');
    expect(inspected.cto_report.reason).toContain('regression');
  });

  it('blocks duplicates and invalid initial states', async () => {
    const subject = await store();
    await subject.create(task());
    await expectCode(() => subject.create(task()), 'TASK_EXISTS');
    await expectCode(() => subject.create(task('IBOS-1001', { status: 'active' })), 'TASK_NOT_PENDING');
  });

  it('surfaces corrupt stored reports instead of hiding them', async () => {
    const subject = await store();
    await subject.create(task());
    await subject.activate('IBOS-1000');
    await subject.report('IBOS-1000', report());
    await writeFile(join(subject.root, 'reports', 'hermes', 'IBOS-1000.json'), '{broken', 'utf8');
    await expectCode(() => subject.inspect('IBOS-1000'), 'INVALID_STORED_JSON');
  });
});
