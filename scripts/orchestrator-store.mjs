import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { transitionTask, validateTaskContract } from './orchestrator-state.mjs';
import { validateExecutionReport } from './orchestrator-prompt-adapters.mjs';
import { evaluateGitEvidence } from './orchestrator-git-evidence.mjs';

const statuses = ['pending', 'active', 'review', 'blocked', 'completed'];

export class OrchestratorStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrchestratorStoreError';
    this.code = code;
  }
}

export class OrchestratorStore {
  constructor(root = '.orchestrator') {
    this.root = root;
  }

  async initialize() {
    await Promise.all([
      ...statuses.map((status) => mkdir(join(this.root, 'tasks', status), { recursive: true })),
      mkdir(join(this.root, 'reports', 'hermes'), { recursive: true }),
      mkdir(join(this.root, 'reports', 'cto'), { recursive: true }),
    ]);
  }

  async create(taskInput) {
    await this.initialize();
    const task = validateTaskContract(taskInput);
    if (task.status !== 'pending') throw new OrchestratorStoreError('TASK_NOT_PENDING', 'New tasks must start pending.');
    if (await this.find(task.task_id)) throw new OrchestratorStoreError('TASK_EXISTS', `${task.task_id} already exists.`);
    await atomicWrite(this.taskPath('pending', task.task_id), task);
    return structuredClone(task);
  }

  async activate(taskId) {
    const record = await this.require(taskId, 'pending');
    const tasks = await this.list();
    const active = transitionTask(record.task, 'active', tasks.map((item) => item.task));
    await this.move(record.path, this.taskPath('active', taskId), active);
    return active;
  }

  async report(taskId, reportInput) {
    const record = await this.require(taskId, 'active');
    const report = validateExecutionReport(reportInput, record.task);
    const nextStatus = report.status === 'completed' ? 'review' : 'blocked';
    const updated = transitionTask(record.task, nextStatus);
    await atomicWrite(join(this.root, 'reports', 'hermes', `${taskId}.json`), report);
    await this.move(record.path, this.taskPath(nextStatus, taskId), updated);
    return { task: updated, report };
  }

  async approve(taskId, evidence, { founderApproved = false } = {}) {
    const record = await this.require(taskId, 'review');
    if (record.task.requires_founder_approval && !founderApproved) {
      throw new OrchestratorStoreError('FOUNDER_APPROVAL_REQUIRED', `${taskId} requires founder approval.`);
    }
    const report = await readJson(join(this.root, 'reports', 'hermes', `${taskId}.json`));
    const decision = evaluateGitEvidence(record.task, report, evidence);
    if (decision.decision !== 'APPROVED') return decision;
    const completed = transitionTask(record.task, 'completed');
    await atomicWrite(join(this.root, 'reports', 'cto', `${taskId}.json`), decision);
    await this.move(record.path, this.taskPath('completed', taskId), completed);
    return decision;
  }

  async reject(taskId, reason) {
    if (typeof reason !== 'string' || reason.trim() === '') throw new OrchestratorStoreError('REASON_REQUIRED', 'A rejection reason is required.');
    const record = await this.require(taskId, 'review');
    const tasks = await this.list();
    const active = transitionTask(record.task, 'active', tasks.map((item) => item.task));
    const decision = { task_id: taskId, decision: 'CORRECTIONS_REQUIRED', reason: reason.trim() };
    await atomicWrite(join(this.root, 'reports', 'cto', `${taskId}.json`), decision);
    await this.move(record.path, this.taskPath('active', taskId), active);
    return decision;
  }

  async inspect(taskId) {
    const record = await this.find(taskId);
    if (!record) throw new OrchestratorStoreError('TASK_NOT_FOUND', `${taskId} was not found.`);
    return {
      task: record.task,
      hermes_report: await optionalJson(join(this.root, 'reports', 'hermes', `${taskId}.json`)),
      cto_report: await optionalJson(join(this.root, 'reports', 'cto', `${taskId}.json`)),
    };
  }

  async status() {
    const tasks = await this.list();
    return {
      total: tasks.length,
      counts: Object.fromEntries(statuses.map((status) => [status, tasks.filter((item) => item.status === status).length])),
      active_task: tasks.find((item) => item.status === 'active')?.task ?? null,
    };
  }

  async list() {
    await this.initialize();
    const records = [];
    for (const status of statuses) {
      const directory = join(this.root, 'tasks', status);
      for (const name of await readdir(directory)) {
        if (!name.endsWith('.json')) continue;
        const path = join(directory, name);
        const task = validateTaskContract(await readJson(path));
        if (task.status !== status) throw new OrchestratorStoreError('STATE_PATH_MISMATCH', `${task.task_id} is stored under ${status}.`);
        records.push({ status, path, task });
      }
    }
    return records;
  }

  async find(taskId) {
    assertTaskId(taskId);
    return (await this.list()).find((record) => record.task.task_id === taskId) ?? null;
  }

  async require(taskId, status) {
    const record = await this.find(taskId);
    if (!record) throw new OrchestratorStoreError('TASK_NOT_FOUND', `${taskId} was not found.`);
    if (record.status !== status) throw new OrchestratorStoreError('TASK_STATE_MISMATCH', `${taskId} is ${record.status}, expected ${status}.`);
    return record;
  }

  taskPath(status, taskId) {
    assertTaskId(taskId);
    return join(this.root, 'tasks', status, `${taskId}.json`);
  }

  async move(source, destination, value) {
    await atomicWrite(source, value);
    await mkdir(join(this.root, 'tasks', value.status), { recursive: true });
    await rename(source, destination);
  }
}

function assertTaskId(taskId) {
  if (!/^IBOS-[0-9]{4,}$/.test(taskId)) throw new OrchestratorStoreError('INVALID_TASK_ID', 'task ID must match IBOS-0001.');
}

async function atomicWrite(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw new OrchestratorStoreError('INVALID_STORED_JSON', `Cannot read ${path}: ${error.message}`); }
}

async function optionalJson(path) {
  try { return await readJson(path); }
  catch (error) {
    if (error.cause?.code === 'ENOENT' || error.message.includes('ENOENT')) return null;
    return null;
  }
}
