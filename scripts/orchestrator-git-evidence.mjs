import { validateTaskContract } from './orchestrator-state.mjs';
import { validateExecutionReport } from './orchestrator-prompt-adapters.mjs';

export class OrchestratorEvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrchestratorEvidenceError';
    this.code = code;
  }
}

export function evaluateGitEvidence(taskInput, reportInput, evidenceInput) {
  const task = validateTaskContract(taskInput);
  const report = validateExecutionReport(task, reportInput);
  const evidence = validateEvidenceShape(evidenceInput);
  const findings = [];

  if (evidence.branch !== report.branch) findings.push(finding('BRANCH_MISMATCH', 'reported branch does not match Git evidence'));
  if (evidence.headSha !== report.commit) findings.push(finding('HEAD_MOVED', 'reported commit is not the current branch head'));

  const reportedFiles = [...report.files_changed].sort();
  const actualFiles = [...evidence.changedFiles].sort();
  if (JSON.stringify(reportedFiles) !== JSON.stringify(actualFiles)) {
    findings.push(finding('DIFF_MISMATCH', 'reported files do not match the verified Git diff'));
  }

  for (const command of task.required_commands) {
    const check = evidence.checks.find((candidate) => candidate.name === command);
    if (!check) findings.push(finding('CHECK_MISSING', `missing verified check: ${command}`));
    else if (check.status !== 'success') findings.push(finding('CHECK_FAILED', `verified check failed: ${command}`));
  }

  if (evidence.dirty) findings.push(finding('WORKTREE_DIRTY', 'uncommitted changes exist after the reported commit'));
  if (evidence.baseBranch !== 'main') findings.push(finding('INVALID_BASE', 'the review base must be main'));

  const blocking = findings.filter((item) => item.severity === 'blocking');
  return structuredClone({
    task_id: task.task_id,
    decision: blocking.length === 0 ? 'APPROVED' : 'CORRECTIONS_REQUIRED',
    verified_branch: evidence.branch,
    verified_commit: evidence.headSha,
    findings,
  });
}

function validateEvidenceShape(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new OrchestratorEvidenceError('INVALID_EVIDENCE', 'Git evidence must be an object.');
  }
  for (const key of ['branch', 'baseBranch', 'headSha']) {
    if (typeof evidence[key] !== 'string' || evidence[key].trim() === '') {
      throw new OrchestratorEvidenceError('INVALID_EVIDENCE', `${key} must be a non-empty string.`);
    }
  }
  if (!/^[0-9a-f]{7,40}$/.test(evidence.headSha)) {
    throw new OrchestratorEvidenceError('INVALID_EVIDENCE', 'headSha must be a Git SHA.');
  }
  if (!Array.isArray(evidence.changedFiles) || evidence.changedFiles.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new OrchestratorEvidenceError('INVALID_EVIDENCE', 'changedFiles must be a string array.');
  }
  if (!Array.isArray(evidence.checks) || evidence.checks.some((item) => !item || typeof item.name !== 'string' || !['success', 'failure', 'pending'].includes(item.status))) {
    throw new OrchestratorEvidenceError('INVALID_EVIDENCE', 'checks must contain name/status records.');
  }
  if (typeof evidence.dirty !== 'boolean') throw new OrchestratorEvidenceError('INVALID_EVIDENCE', 'dirty must be boolean.');
  return structuredClone(evidence);
}

function finding(code, message) {
  return { code, severity: 'blocking', message };
}
