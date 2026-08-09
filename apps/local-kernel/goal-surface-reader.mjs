const MAX_GOAL_ID_LENGTH = 240;

export class GoalSurfaceReaderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GoalSurfaceReaderError';
    this.code = code;
  }
}

/**
 * Read-only adapter from the local persistence shape to Kernel-owned GoalSurfaceSnapshot v1.
 * The adapter never calls store.project/write and does not own Goal/Mission semantics.
 */
export class GoalSurfaceReader {
  constructor(store, buildSnapshots, options = {}) {
    if (!store || typeof store.read !== 'function') throw invalid('store.read is required');
    if (typeof buildSnapshots !== 'function') throw invalid('Kernel Goal surface projector is required');
    this.store = store;
    this.buildSnapshots = buildSnapshots;
    this.now = options.now ?? (() => new Date());
  }

  async list() {
    const data = await this.store.read();
    const observedAt = normalizeObservedAt(this.now());
    return this.buildSnapshots({
      goals: Array.isArray(data?.goals) ? data.goals : [],
      missions: Array.isArray(data?.agentMissions) ? data.agentMissions : [],
      observedAt,
    });
  }

  async get(goalId) {
    const normalizedGoalId = requireGoalId(goalId);
    const snapshots = await this.list();
    if (!Array.isArray(snapshots)) throw invalid('Kernel Goal surface projector returned an invalid snapshot list');
    return snapshots.find((snapshot) => snapshot?.goal?.id === normalizedGoalId);
  }
}

/**
 * Production composition is intentionally lazy: launcher/source-tree startup must not
 * require packages/kernel/dist before any Goal-surface read is requested. Packaged
 * installs build the trusted Kernel runtime before launch; source-tree readers fail
 * closed on the first read if that runtime is still unavailable.
 */
class LazyGoalSurfaceReader {
  constructor(store, options = {}) {
    if (!store || typeof store.read !== 'function') throw invalid('store.read is required');
    this.store = store;
    this.now = options.now ?? (() => new Date());
    this.delegate = undefined;
  }

  async list() {
    return (await this.#resolve()).list();
  }

  async get(goalId) {
    const normalizedGoalId = requireGoalId(goalId);
    return (await this.#resolve()).get(normalizedGoalId);
  }

  async #resolve() {
    if (this.delegate) return this.delegate;
    const kernel = await loadKernel();
    if (!kernel || typeof kernel.buildGoalSurfaceSnapshots !== 'function') {
      throw invalid('Built Kernel does not expose buildGoalSurfaceSnapshots');
    }
    this.delegate = new GoalSurfaceReader(this.store, kernel.buildGoalSurfaceSnapshots, { now: this.now });
    return this.delegate;
  }
}

/** Production composition defers loading the already-built trusted Kernel package until the first read. */
export async function createGoalSurfaceReader(store, options = {}) {
  if (options.kernel !== undefined) {
    if (!options.kernel || typeof options.kernel.buildGoalSurfaceSnapshots !== 'function') {
      throw invalid('Built Kernel does not expose buildGoalSurfaceSnapshots');
    }
    return new GoalSurfaceReader(store, options.kernel.buildGoalSurfaceSnapshots, { now: options.now });
  }
  return new LazyGoalSurfaceReader(store, { now: options.now });
}

async function loadKernel() {
  try {
    return await import('../../packages/kernel/dist/index.js');
  } catch (error) {
    throw new GoalSurfaceReaderError(
      'KERNEL_RUNTIME_UNAVAILABLE',
      `Goal surface projection requires the Kernel package to be built first: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function requireGoalId(value) {
  if (typeof value !== 'string') throw invalid('goalId must be a string');
  const normalized = value.trim();
  if (!normalized
    || normalized.length > MAX_GOAL_ID_LENGTH
    || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw invalid('goalId is invalid');
  }
  return normalized;
}

function normalizeObservedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid('Goal surface clock returned an invalid date');
  return date.toISOString();
}

function invalid(message) {
  return new GoalSurfaceReaderError('INVALID_GOAL_SURFACE_READER_INPUT', message);
}
