const AUTOMATIC_SEARCH_CAPABILITY = 'web.search';
const PUBLIC_WEB_COMPOSITE_ALIAS = 'public_web_research';

export class AutomaticMissionClaimGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AutomaticMissionClaimGateError';
    this.code = code;
  }
}

export class AutomaticMissionClaimGate {
  constructor(options = {}) {
    this.kernel = options.kernel;
    this.loadKernel = options.loadKernel ?? loadBuiltKernel;
    this.enforceRuntimeReadiness = options.enforceRuntimeReadiness ?? !options.kernel;
    this.readOnlyRuntimeReady = options.readOnlyRuntimeReady ?? (() => process.env.HEPHAESTUS_HERMES_READ_ONLY_READY === '1');
  }

  async evaluate(goal, mission) {
    if (!goal || typeof goal !== 'object' || !mission || typeof mission !== 'object') return deny('invalid_input');
    if (typeof goal.id !== 'string' || !goal.id || mission.goalId !== goal.id) return deny('mission_goal_mismatch');
    if (Array.isArray(mission.searchCandidates) && mission.searchCandidates.length > 0) return deny('verification_pending');
    if (this.enforceRuntimeReadiness && this.readOnlyRuntimeReady() !== true) return deny('runtime_read_only_unverified');

    let required;
    try {
      const kernel = await this.#kernel();
      required = requiredKernelExports(kernel);
    } catch {
      // A missing or malformed compiled Kernel must block automatic work safely.
      // It must never surface as a worker HTTP 500 or look like active research.
      return deny('trusted_kernel_unavailable');
    }
    const context = capabilityContext(goal);
    if (!context) return deny('invalid_goal');

    const registry = new required.CapabilityRegistry([required.PUBLIC_WEB_SEARCH_CAPABILITY]);
    let authorized;
    try {
      authorized = registry.authorize(
        { capabilityId: AUTOMATIC_SEARCH_CAPABILITY, version: '1' },
        {
          planId: mission.id ?? `mission:${goal.id}`,
          goalAllowedCapabilities: context.allowedCapabilities,
          goalForbiddenCapabilities: context.forbiddenCapabilities,
          goalAllowedDataScopes: context.allowedDataScopes,
          goalForbiddenDataScopes: context.forbiddenDataScopes,
        },
      );
    } catch {
      return deny(`capability_denied:${AUTOMATIC_SEARCH_CAPABILITY}`);
    }

    const decision = required.evaluateAutomaticReadOnlyContinuation({
      goal: {
        id: goal.id,
        revision: context.revision,
        status: goal.status,
        approvalPolicy: context.approvalPolicy,
      },
      authorization: mission.authorization,
      capability: authorized,
    });
    if (!decision?.allowed) return deny(decision?.reason ?? 'policy_denied');

    return {
      allowed: true,
      policyVersion: required.AUTOMATIC_READ_ONLY_POLICY_VERSION,
      authorizationRef: mission.authorization?.id,
      capabilityIds: [AUTOMATIC_SEARCH_CAPABILITY],
    };
  }

  async #kernel() {
    if (this.kernel) return this.kernel;
    this.kernel = await this.loadKernel();
    return this.kernel;
  }
}

export function createAutomaticMissionClaimGate(options = {}) {
  return new AutomaticMissionClaimGate(options);
}

function capabilityContext(goal) {
  if (goal.contractVersion === 2) {
    const revision = Number(goal.currentRevision?.revision);
    if (!Number.isInteger(revision) || revision < 1 || typeof goal.approvalConfig?.policy !== 'string') return undefined;
    return {
      revision,
      approvalPolicy: goal.approvalConfig.policy,
      allowedCapabilities: conservativeAllowedCapabilities(goal.allowedCapabilities, goal.constraints?.allowedCapabilities),
      forbiddenCapabilities: unionExpanded(goal.forbiddenCapabilities, goal.constraints?.forbiddenCapabilities),
      allowedDataScopes: conservativeAllowed(goal.allowedDataScopes, goal.constraints?.allowedDataScopes),
      forbiddenDataScopes: union(goal.constraints?.forbiddenDataScopes),
    };
  }

  if (!Array.isArray(goal.categories)) return undefined;
  return {
    revision: 1,
    approvalPolicy: 'legacy_none',
    allowedCapabilities: [AUTOMATIC_SEARCH_CAPABILITY],
    forbiddenCapabilities: [],
    allowedDataScopes: ['public_web'],
    forbiddenDataScopes: [],
  };
}

function conservativeAllowedCapabilities(...sets) {
  return conservativeAllowed(...sets.map((values) => expandComposite(Array.isArray(values) ? values : [])));
}

function unionExpanded(...sets) {
  return union(...sets.map((values) => expandComposite(Array.isArray(values) ? values : [])));
}

function expandComposite(values) {
  const expanded = new Set();
  for (const value of values) {
    if (value === PUBLIC_WEB_COMPOSITE_ALIAS) expanded.add(AUTOMATIC_SEARCH_CAPABILITY);
    else expanded.add(value);
  }
  return [...expanded];
}

function conservativeAllowed(...sets) {
  const populated = sets.filter((values) => Array.isArray(values) && values.length > 0).map((values) => new Set(values));
  if (!populated.length) return [];
  return [...populated[0]].filter((value) => populated.every((set) => set.has(value)));
}

function union(...sets) {
  return [...new Set(sets.flatMap((values) => Array.isArray(values) ? values : []))];
}

function requiredKernelExports(kernel) {
  if (!kernel
    || typeof kernel.CapabilityRegistry !== 'function'
    || !kernel.PUBLIC_WEB_SEARCH_CAPABILITY
    || typeof kernel.evaluateAutomaticReadOnlyContinuation !== 'function'
    || typeof kernel.AUTOMATIC_READ_ONLY_POLICY_VERSION !== 'string') {
    throw new AutomaticMissionClaimGateError('KERNEL_RUNTIME_INVALID', 'Built Kernel does not expose automatic public-web search authorization contracts');
  }
  return kernel;
}

async function loadBuiltKernel() {
  try {
    return await import('../../packages/kernel/dist/index.js');
  } catch {
    throw new AutomaticMissionClaimGateError('KERNEL_RUNTIME_UNAVAILABLE', 'Automatic Mission authorization requires the trusted Kernel package to be built first');
  }
}

function deny(reason) {
  return { allowed: false, reason };
}
