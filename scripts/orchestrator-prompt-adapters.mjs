import { OrchestratorStateError, validateTaskContract } from './orchestrator-state.mjs';

const reportStatuses = new Set(['completed', 'blocked', 'failed']);
const reportFields = Object.freeze([
  'task_id',
  'status',
  'summary',
  'branch',
  'commit',
  'files_changed',
  'commands_run',
  'test_results',
  'acceptance_criteria_results',
  'risks',
  'deviations',
  'recommended_next_step',
]);

export function createHermesExecutorPrompt(task) {
  const contract = requireActiveTask(task);
  return renderPrompt('Hermes Executor', contract, [
    'Operate only inside the approved task contract.',
    'You may invoke a coding agent, inspect files, and run the required commands.',
    'Do not merge, deploy, change secrets, delete data, or expand scope.',
    'Return exactly one JSON execution report matching the repository schema.',
    'If any requirement cannot be satisfied, return status blocked or failed with evidence.',
  ]);
}

export function createCodexImplementerPrompt(task) {
  const contract = requireActiveTask(task);
  return renderPrompt('Codex Implementer', contract, [
    'Implement only the measurable objective below.',
    'Modify only allowed paths and never touch forbidden paths.',
    'Preserve existing behavior unless an acceptance criterion explicitly requires change.',
    'Do not commit, push, merge, deploy, access secrets, or start another task.',
    'Run or request every required command and report exact evidence to Hermes.',
  ]);
}

export function validateExecutionReport(report, task) {
  const contract = validateTaskContract(task);
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new OrchestratorStateError('INVALID_REPORT', 'Execution report must be an object.');
  }

  const unknown = Object.keys(report).filter((key) => !reportFields.includes(key));
  if (unknown.length > 0) {
    throw new OrchestratorStateError('INVALID_REPORT', `Unknown report fields: ${unknown.join(', ')}`);
  }

  for (const field of reportFields) {
    if (!(field in report)) {
      throw new OrchestratorStateError('INVALID_REPORT', `Missing report field: ${field}`);
    }
  }

  if (report.task_id !== contract.task_id) {
    throw new OrchestratorStateError('TASK_REPORT_MISMATCH', `Report task ${report.task_id} does not match ${contract.task_id}.`);
  }
  if (!reportStatuses.has(report.status)) {
    throw new OrchestratorStateError('INVALID_REPORT_STATUS', `Unsupported report status: ${report.status}`);
  }
  for (const field of ['summary', 'branch', 'commit', 'recommended_next_step']) {
    if (typeof report[field] !== 'string' || report[field].trim() === '') {
      throw new OrchestratorStateError('INVALID_REPORT', `${field} must be a non-empty string.`);
    }
  }
  if (report.branch === 'main') {
    throw new OrchestratorStateError('MAIN_BRANCH_FORBIDDEN', 'Execution reports cannot claim work directly on main.');
  }
  if (!/^[0-9a-f]{7,40}$/.test(report.commit)) {
    throw new OrchestratorStateError('INVALID_COMMIT', 'commit must be a 7-40 character lowercase hexadecimal SHA.');
  }

  for (const field of ['files_changed', 'commands_run', 'test_results', 'acceptance_criteria_results', 'risks', 'deviations']) {
    if (!Array.isArray(report[field]) || report[field].some((value) => typeof value !== 'string' || value.trim() === '')) {
      throw new OrchestratorStateError('INVALID_REPORT', `${field} must be a string array.`);
    }
  }

  const forbiddenChanges = report.files_changed.filter((path) => matchesAnyPath(path, contract.forbidden_paths));
  if (forbiddenChanges.length > 0) {
    throw new OrchestratorStateError('FORBIDDEN_PATH_CHANGED', `Forbidden paths changed: ${forbiddenChanges.join(', ')}`);
  }
  const outsideScope = report.files_changed.filter((path) => !matchesAnyPath(path, contract.allowed_paths));
  if (outsideScope.length > 0) {
    throw new OrchestratorStateError('OUTSIDE_ALLOWED_PATHS', `Files outside allowed paths: ${outsideScope.join(', ')}`);
  }

  if (report.status === 'completed') {
    const missingCommands = contract.required_commands.filter((command) => !report.commands_run.includes(command));
    if (missingCommands.length > 0) {
      throw new OrchestratorStateError('REQUIRED_COMMAND_MISSING', `Required commands missing: ${missingCommands.join(', ')}`);
    }
    if (report.acceptance_criteria_results.length < contract.acceptance_criteria.length) {
      throw new OrchestratorStateError('ACCEPTANCE_EVIDENCE_MISSING', 'Completed report lacks acceptance-criteria evidence.');
    }
    if (contract.requires_tests && report.test_results.length === 0) {
      throw new OrchestratorStateError('TEST_EVIDENCE_MISSING', 'Completed report lacks test evidence.');
    }
  }

  return structuredClone(report);
}

function requireActiveTask(task) {
  const contract = validateTaskContract(task);
  if (contract.status !== 'active') {
    throw new OrchestratorStateError('TASK_NOT_ACTIVE', `${contract.task_id} must be active before generating prompts.`);
  }
  return contract;
}

function renderPrompt(role, contract, rules) {
  return [
    `# ${role} — ${contract.task_id}`,
    '',
    ...rules.map((rule) => `- ${rule}`),
    '',
    '## Objective',
    contract.objective,
    '',
    '## Business value',
    contract.business_value,
    '',
    '## Allowed paths',
    ...contract.allowed_paths.map((path) => `- ${path}`),
    '',
    '## Forbidden paths',
    ...contract.forbidden_paths.map((path) => `- ${path}`),
    '',
    '## Acceptance criteria',
    ...contract.acceptance_criteria.map((criterion, index) => `${index + 1}. ${criterion}`),
    '',
    '## Required commands',
    ...contract.required_commands.map((command) => `- ${command}`),
    '',
    `Founder approval required: ${contract.requires_founder_approval}`,
    'Production deployment allowed: false',
  ].join('\n');
}

function matchesAnyPath(path, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/**')) return path === pattern.slice(0, -3) || path.startsWith(pattern.slice(0, -2));
    if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
    return path === pattern;
  });
}
