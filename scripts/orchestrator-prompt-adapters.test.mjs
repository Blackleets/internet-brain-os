import { describe, expect, it } from 'vitest';
import {
  createCodexImplementerPrompt,
  createHermesExecutorPrompt,
  validateExecutionReport,
} from './orchestrator-prompt-adapters.mjs';

function task(overrides = {}) {
  return {
    task_id: 'IBOS-0002',
    title: 'Prompt adapters',
    objective: 'Generate bounded prompts and validate execution reports.',
    business_value: 'Prevent agents from escaping approved scope.',
    status: 'active',
    allowed_paths: ['scripts/orchestrator-*', '.orchestrator/**'],
    forbidden_paths: ['.env', 'infra/production/**'],
    acceptance_criteria: ['Prompts include boundaries.', 'Reports reject unsafe evidence.'],
    required_commands: ['pnpm test', 'pnpm build'],
    requires_tests: true,
    requires_founder_approval: false,
    production_deploy_allowed: false,
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    task_id: 'IBOS-0002',
    status: 'completed',
    summary: 'Implemented and validated adapters.',
    branch: 'phase/b-orchestrator-prompt-adapters',
    commit: 'abcdef1',
    files_changed: ['scripts/orchestrator-prompt-adapters.mjs'],
    commands_run: ['pnpm test', 'pnpm build'],
    test_results: ['All adapter tests passed.'],
    acceptance_criteria_results: ['Prompt boundaries verified.', 'Unsafe reports rejected.'],
    risks: [],
    deviations: [],
    recommended_next_step: 'Review the pull request.',
    ...overrides,
  };
}

function captureCode(run) {
  try {
    run();
  } catch (error) {
    return error.code;
  }
  throw new Error('Expected operation to throw.');
}

describe('orchestrator prompt adapters', () => {
  it('renders bounded Hermes and Codex prompts from an active task', () => {
    const hermes = createHermesExecutorPrompt(task());
    const codex = createCodexImplementerPrompt(task());

    for (const prompt of [hermes, codex]) {
      expect(prompt).toContain('IBOS-0002');
      expect(prompt).toContain('scripts/orchestrator-*');
      expect(prompt).toContain('.env');
      expect(prompt).toContain('pnpm test');
      expect(prompt).toContain('Production deployment allowed: false');
    }
    expect(hermes).toContain('Return exactly one JSON execution report');
    expect(codex).toContain('Do not commit, push, merge, deploy');
  });

  it('rejects prompt generation for inactive tasks', () => {
    expect(captureCode(() => createHermesExecutorPrompt(task({ status: 'pending' })))).toBe('TASK_NOT_ACTIVE');
  });

  it('accepts a complete, scoped report and returns a defensive copy', () => {
    const source = report();
    const validated = validateExecutionReport(source, task());
    validated.files_changed.push('.orchestrator/README.md');
    expect(source.files_changed).toEqual(['scripts/orchestrator-prompt-adapters.mjs']);
  });

  it('rejects reports for the wrong task or main branch', () => {
    expect(captureCode(() => validateExecutionReport(report({ task_id: 'IBOS-9999' }), task()))).toBe('TASK_REPORT_MISMATCH');
    expect(captureCode(() => validateExecutionReport(report({ branch: 'main' }), task()))).toBe('MAIN_BRANCH_FORBIDDEN');
  });

  it('rejects forbidden and out-of-scope file changes', () => {
    expect(captureCode(() => validateExecutionReport(report({ files_changed: ['.env'] }), task()))).toBe('FORBIDDEN_PATH_CHANGED');
    expect(captureCode(() => validateExecutionReport(report({ files_changed: ['packages/kernel/src/index.ts'] }), task()))).toBe('OUTSIDE_ALLOWED_PATHS');
  });

  it('requires command, test, and acceptance evidence for completed reports', () => {
    expect(captureCode(() => validateExecutionReport(report({ commands_run: ['pnpm test'] }), task()))).toBe('REQUIRED_COMMAND_MISSING');
    expect(captureCode(() => validateExecutionReport(report({ test_results: [] }), task()))).toBe('TEST_EVIDENCE_MISSING');
    expect(captureCode(() => validateExecutionReport(report({ acceptance_criteria_results: ['one result'] }), task()))).toBe('ACCEPTANCE_EVIDENCE_MISSING');
  });

  it('rejects blank report evidence instead of counting it as completion proof', () => {
    expect(captureCode(() => validateExecutionReport(report({ test_results: ['  '] }), task()))).toBe('INVALID_REPORT');
    expect(captureCode(() => validateExecutionReport(report({ acceptance_criteria_results: ['', ''] }), task()))).toBe('INVALID_REPORT');
  });

  it('permits blocked reports without pretending completion evidence exists', () => {
    const blocked = validateExecutionReport(report({
      status: 'blocked',
      commands_run: [],
      test_results: [],
      acceptance_criteria_results: [],
      recommended_next_step: 'Resolve missing repository access.',
    }), task());
    expect(blocked.status).toBe('blocked');
  });
});
