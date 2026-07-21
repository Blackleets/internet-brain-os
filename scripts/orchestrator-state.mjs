const transitions = Object.freeze({
  pending: new Set(['active']),
  active: new Set(['review', 'blocked']),
  review: new Set(['completed', 'blocked', 'active']),
  blocked: new Set(['pending']),
  completed: new Set(),
});

export const orchestratorStatuses = Object.freeze(Object.keys(transitions));

export class OrchestratorStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrchestratorStateError';
    this.code = code;
  }
}

export function validateTaskContract(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw new OrchestratorStateError('INVALID_TASK', 'Task contract must be an object.');
  }

  const requiredStrings = ['task_id', 'title', 'objective', 'business_value'];
  for (const key of requiredStrings) {
    if (typeof task[key] !== 'string' || task[key].trim() === '') {
      throw new OrchestratorStateError('INVALID_TASK', `${key} must be a non-empty string.`);
    }
  }

  if (!/^IBOS-[0-9]{4,}$/.test(task.task_id)) {
    throw new OrchestratorStateError('INVALID_TASK_ID', 'task_id must match IBOS-0001 format.');
  }

  if (!orchestratorStatuses.includes(task.status)) {
    throw new OrchestratorStateError('INVALID_STATUS', `Unsupported task status: ${task.status}`);
  }

  for (const key of ['allowed_paths', 'forbidden_paths', 'acceptance_criteria', 'required_commands']) {
    if (!Array.isArray(task[key]) || task[key].length === 0 || task[key].some((value) => typeof value !== 'string' || value.trim() === '')) {
      throw new OrchestratorStateError('INVALID_TASK', `${key} must be a non-empty string array.`);
    }
  }

  for (const key of ['requires_tests', 'requires_founder_approval', 'production_deploy_allowed']) {
    if (typeof task[key] !== 'boolean') {
      throw new OrchestratorStateError('INVALID_TASK', `${key} must be boolean.`);
    }
  }

  if (task.production_deploy_allowed !== false) {
    throw new OrchestratorStateError('PRODUCTION_DEPLOY_FORBIDDEN', 'Phase A never permits production deployment.');
  }

  return structuredClone(task);
}

export function transitionTask(task, nextStatus, allTasks) {
  const current = validateTaskContract(task);
  if (!orchestratorStatuses.includes(nextStatus)) {
    throw new OrchestratorStateError('INVALID_STATUS', `Unsupported task status: ${nextStatus}`);
  }

  if (!transitions[current.status].has(nextStatus)) {
    throw new OrchestratorStateError('INVALID_TRANSITION', `Cannot move ${current.task_id} from ${current.status} to ${nextStatus}.`);
  }

  if (nextStatus === 'active') {
    if (!Array.isArray(allTasks)) {
      throw new OrchestratorStateError(
        'TASK_SET_REQUIRED',
        'The complete task set is required before activating a task.',
      );
    }
    const conflicting = allTasks.find((candidate) => candidate.task_id !== current.task_id && candidate.status === 'active');
    if (conflicting) {
      throw new OrchestratorStateError('ACTIVE_TASK_EXISTS', `${conflicting.task_id} is already active.`);
    }
  }

  return { ...current, status: nextStatus };
}
