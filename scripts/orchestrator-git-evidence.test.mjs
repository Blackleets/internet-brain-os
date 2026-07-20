import { describe, expect, it } from 'vitest';
import { evaluateGitEvidence, OrchestratorEvidenceError } from './orchestrator-git-evidence.mjs';

const task = {
  task_id: 'IBOS-0003', title: 'Git evidence', objective: 'Verify real repository evidence.', business_value: 'Prevent false completion claims.',
  status: 'review', allowed_paths: ['scripts/orchestrator-*'], forbidden_paths: ['.env', 'infra/production/**'],
  acceptance_criteria: ['Git evidence matches report.'], required_commands: ['pnpm test', 'pnpm build'],
  requires_tests: true, requires_founder_approval: false, production_deploy_allowed: false,
};

const report = {
  task_id: 'IBOS-0003', status: 'completed', summary: 'Implemented evidence checks.', branch: 'phase/c-orchestrator-git-evidence',
  commit: 'abcdef1234567', files_changed: ['scripts/orchestrator-git-evidence.mjs'], commands_run: ['pnpm test', 'pnpm build'],
  test_results: ['tests passed'], acceptance_criteria_results: ['Git evidence matches report.'], risks: [], deviations: [], recommended_next_step: 'Review.',
};

const evidence = {
  branch: report.branch, baseBranch: 'main', headSha: report.commit, changedFiles: report.files_changed,
  checks: [{ name: 'pnpm test', status: 'success' }, { name: 'pnpm build', status: 'success' }], dirty: false,
};

describe('orchestrator Git evidence', () => {
  it('approves matching immutable evidence', () => {
    const result = evaluateGitEvidence(task, report, evidence);
    expect(result.decision).toBe('APPROVED');
    expect(result.findings).toEqual([]);
  });

  it('detects a moved head and changed diff', () => {
    const result = evaluateGitEvidence(task, report, { ...evidence, headSha: '1234567abcdef', changedFiles: ['unexpected.txt'] });
    expect(result.decision).toBe('CORRECTIONS_REQUIRED');
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(['HEAD_MOVED', 'DIFF_MISMATCH']));
  });

  it('blocks failed or missing verified checks', () => {
    const result = evaluateGitEvidence(task, report, { ...evidence, checks: [{ name: 'pnpm test', status: 'failure' }] });
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(['CHECK_FAILED', 'CHECK_MISSING']));
  });

  it('blocks dirty worktrees and non-main bases', () => {
    const result = evaluateGitEvidence(task, report, { ...evidence, dirty: true, baseBranch: 'develop' });
    expect(result.findings.map((item) => item.code)).toEqual(expect.arrayContaining(['WORKTREE_DIRTY', 'INVALID_BASE']));
  });

  it('rejects malformed evidence', () => {
    try { evaluateGitEvidence(task, report, { ...evidence, headSha: 'bad' }); throw new Error('expected failure'); }
    catch (error) { expect(error).toBeInstanceOf(OrchestratorEvidenceError); expect(error.code).toBe('INVALID_EVIDENCE'); }
  });
});
