import type {
  BootstrapStatus,
  CaseSummary,
  GoalIntelligencePlan,
  GoalSummary,
  IntegrationCatalog,
  IntegrationSummary,
  KernelHealth,
  KernelStatus,
  MissionSummary,
  ModelForgeSummary,
  OpportunitySummary,
  PublicSearchSnapshot,
} from './contracts';

export class KernelContractError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'KernelContractError';
  }
}

const CASE_STATUSES = ['draft', 'active', 'archived'] as const;
const MISSION_STATUSES = ['waiting_for_agent', 'queued', 'running', 'completed', 'failed'] as const;
const MISSION_PHASES = ['queued', 'investigating', 'verifying', 'forged', 'failed'] as const;
const OPPORTUNITY_STATUSES = ['new', 'dismissed'] as const;
const HARDWARE_TIERS = ['light', 'balanced', 'powerful'] as const;
const INTEGRATION_KINDS = ['core', 'agent', 'memory', 'capture', 'model', 'transport'] as const;
const INTEGRATION_ADAPTERS = ['native', 'mcp'] as const;
const INTEGRATION_STATUSES = ['ready', 'not_configured', 'degraded', 'unavailable'] as const;
const GOAL_INTELLIGENCE_AUTHORITIES = ['kernel', 'web-runtime'] as const;
const INTEGRATION_ACTIONS = ['settings', 'agents', 'models'] as const;
const GOAL_INTELLIGENCE_REASONS = ['public_research', 'goal_signal'] as const;
const GOAL_INTELLIGENCE_MODES = ['public_research', 'connector_research'] as const;
const GOAL_INTELLIGENCE_READINESS = ['ready', 'needs_setup', 'unavailable'] as const;
const GOAL_INTELLIGENCE_ACTIONS = ['confirm_goal', 'configure_source'] as const;

export function parseHealth(value: unknown): KernelHealth {
  const body = envelope(value, 'health');
  return {
    ...body,
    ok: true,
    service: literal(body.service, 'health.service', 'hephaestus-local-kernel'),
    hermes: boolean(body.hermes, 'health.hermes'),
    replayLab: boolean(body.replayLab, 'health.replayLab'),
  };
}

export function parseStatus(value: unknown): KernelStatus {
  const body = envelope(value, 'status');
  return {
    ...body,
    ok: true,
    service: literal(body.service, 'status.service', 'hephaestus-local-kernel'),
    kernel: literal(body.kernel, 'status.kernel', 'ready'),
    hermes: enumeration(body.hermes, 'status.hermes', ['ready', 'disabled'] as const),
    replayLab: enumeration(body.replayLab, 'status.replayLab', ['ready', 'disabled'] as const),
    ollama: enumeration(body.ollama, 'status.ollama', ['configured', 'not_configured'] as const),
    obsidian: enumeration(body.obsidian, 'status.obsidian', ['configured', 'not_configured'] as const),
  };
}

export function parseBootstrap(value: unknown): BootstrapStatus {
  const body = record(value, 'bootstrap');
  return {
    ...body,
    schemaVersion: literal(body.schemaVersion, 'bootstrap.schemaVersion', 'efesto.bootstrap-status.v1'),
    ok: boolean(body.ok, 'bootstrap.ok'),
    kernel: enumeration(body.kernel, 'bootstrap.kernel', ['ready', 'offline', 'stale', 'port_conflict', 'failed'] as const),
    hermes: enumeration(body.hermes, 'bootstrap.hermes', ['ready', 'missing', 'invalid', 'failed'] as const),
    obsidian: enumeration(body.obsidian, 'bootstrap.obsidian', ['ready', 'not_configured', 'unwritable', 'failed'] as const),
    pairing: enumeration(body.pairing, 'bootstrap.pairing', ['paired', 'required', 'invalid'] as const),
    overall: enumeration(body.overall, 'bootstrap.overall', ['ready', 'needs_setup', 'failed'] as const),
    message: string(body.message, 'bootstrap.message'),
    diagnostics: record(body.diagnostics, 'bootstrap.diagnostics'),
    actions: array(body.actions, 'bootstrap.actions').map((action, index) => parseBootstrapAction(action, `bootstrap.actions[${index}]`)),
  };
}

export function parseIntegrationCatalog(value: unknown): IntegrationCatalog {
  const body = envelope(value, 'integrations');
  return {
    ...body,
    schemaVersion: literal(body.schemaVersion, 'integrations.schemaVersion', 'efesto.integration-catalog.v1'),
    authority: literal(body.authority, 'integrations.authority', 'kernel'),
    generatedAt: string(body.generatedAt, 'integrations.generatedAt'),
    integrations: array(body.integrations, 'integrations.integrations').map((item, index) => parseIntegration(item, `integrations.integrations[${index}]`)),
  };
}

export function parseGoalIntelligencePlan(value: unknown): GoalIntelligencePlan {
  const body = envelope(value, 'goalIntelligence');
  const goal = record(body.goal, 'goalIntelligence.goal');
  const intent = record(body.intent, 'goalIntelligence.intent');
  const publicSearch = body.publicSearch === undefined ? undefined : parsePublicSearch(body.publicSearch, 'goalIntelligence.publicSearch');
  return {
    ...body,
    schemaVersion: literal(body.schemaVersion, 'goalIntelligence.schemaVersion', 'efesto.goal-intelligence.v1'),
    authority: enumeration(body.authority, 'goalIntelligence.authority', GOAL_INTELLIGENCE_AUTHORITIES),
    generatedAt: string(body.generatedAt, 'goalIntelligence.generatedAt'),
    goal: {
      title: string(goal.title, 'goalIntelligence.goal.title'),
      categories: array(goal.categories, 'goalIntelligence.goal.categories').map((item, index) => string(item, `goalIntelligence.goal.categories[${index}]`)),
      keywords: array(goal.keywords, 'goalIntelligence.goal.keywords').map((item, index) => string(item, `goalIntelligence.goal.keywords[${index}]`)),
    },
    intent: {
      primaryCategory: goalCategory(intent.primaryCategory, 'goalIntelligence.intent.primaryCategory'),
      mode: enumeration(intent.mode, 'goalIntelligence.intent.mode', GOAL_INTELLIGENCE_MODES),
    },
    sources: array(body.sources, 'goalIntelligence.sources').map((item, index) => parseGoalIntelligenceSource(item, `goalIntelligence.sources[${index}]`)),
    readiness: enumeration(body.readiness, 'goalIntelligence.readiness', GOAL_INTELLIGENCE_READINESS),
    nextAction: enumeration(body.nextAction, 'goalIntelligence.nextAction', GOAL_INTELLIGENCE_ACTIONS),
    limitations: array(body.limitations, 'goalIntelligence.limitations').map((item, index) => string(item, `goalIntelligence.limitations[${index}]`)),
    ...(publicSearch ? { publicSearch } : {}),
  };
}

function parsePublicSearch(value: unknown, path: string): PublicSearchSnapshot {
  const body = record(value, path);
  const results = array(body.results, `${path}.results`).map((item, index) => {
    const result = record(item, `${path}.results[${index}]`);
    return {
      ...result,
      rank: integer(result.rank, `${path}.results[${index}].rank`),
      title: string(result.title, `${path}.results[${index}].title`),
      url: string(result.url, `${path}.results[${index}].url`),
      snippet: string(result.snippet, `${path}.results[${index}].snippet`),
      sourceHost: string(result.sourceHost, `${path}.results[${index}].sourceHost`),
    };
  });
  const error = body.error === undefined ? undefined : string(body.error, `${path}.error`);
  return {
    ...body,
    provider: enumeration(body.provider, `${path}.provider`, ['duckduckgo-html', 'brave-html', 'bing-html', 'unavailable'] as const),
    query: string(body.query, `${path}.query`),
    searchedAt: string(body.searchedAt, `${path}.searchedAt`),
    status: enumeration(body.status, `${path}.status`, ['ready', 'unavailable'] as const),
    results,
    ...(error === undefined ? {} : { error }),
  };
}

function parseIntegration(value: unknown, path: string): IntegrationSummary {
  const item = record(value, path);
  const action = item.action === null ? null : enumeration(item.action, `${path}.action`, INTEGRATION_ACTIONS);
  const count = item.count === undefined ? undefined : nonNegativeNumber(item.count, `${path}.count`);
  const readOnly = item.readOnly === undefined ? undefined : boolean(item.readOnly, `${path}.readOnly`);
  const requiresExplicitConsent = item.requiresExplicitConsent === undefined ? undefined : boolean(item.requiresExplicitConsent, `${path}.requiresExplicitConsent`);
  const statusReason = item.statusReason === undefined ? undefined : string(item.statusReason, `${path}.statusReason`);
  const managedBy = item.managedBy === undefined || item.managedBy === null ? item.managedBy : string(item.managedBy, `${path}.managedBy`);
  return {
    ...item,
    id: string(item.id, `${path}.id`),
    kind: enumeration(item.kind, `${path}.kind`, INTEGRATION_KINDS),
    adapter: enumeration(item.adapter, `${path}.adapter`, INTEGRATION_ADAPTERS),
    status: enumeration(item.status, `${path}.status`, INTEGRATION_STATUSES),
    capabilities: array(item.capabilities, `${path}.capabilities`).map((capability, index) => string(capability, `${path}.capabilities[${index}]`)),
    scopes: array(item.scopes, `${path}.scopes`).map((scope, index) => string(scope, `${path}.scopes[${index}]`)),
    action,
    ...(count === undefined ? {} : { count }),
    ...(readOnly === undefined ? {} : { readOnly }),
    ...(requiresExplicitConsent === undefined ? {} : { requiresExplicitConsent }),
    ...(statusReason === undefined ? {} : { statusReason }),
    ...(managedBy === undefined ? {} : { managedBy }),
  };
}

function parseGoalIntelligenceSource(value: unknown, path: string): GoalIntelligencePlan['sources'][number] {
  const item = record(value, path);
  return {
    ...item,
    id: string(item.id, `${path}.id`),
    adapter: enumeration(item.adapter, `${path}.adapter`, INTEGRATION_ADAPTERS),
    selected: exactTrue(item.selected, `${path}.selected`),
    required: exactTrue(item.required, `${path}.required`),
    reason: enumeration(item.reason, `${path}.reason`, GOAL_INTELLIGENCE_REASONS),
    status: enumeration(item.status, `${path}.status`, INTEGRATION_STATUSES),
    scopes: array(item.scopes, `${path}.scopes`).map((scope, index) => string(scope, `${path}.scopes[${index}]`)),
    requiredCapabilities: array(item.requiredCapabilities, `${path}.requiredCapabilities`).map((capability, index) => string(capability, `${path}.requiredCapabilities[${index}]`)),
    activeCapabilities: array(item.activeCapabilities, `${path}.activeCapabilities`).map((capability, index) => string(capability, `${path}.activeCapabilities[${index}]`)),
    action: item.action === null ? null : enumeration(item.action, `${path}.action`, INTEGRATION_ACTIONS),
  };
}

export function parseCases(value: unknown): CaseSummary[] {
  return collection(value, 'cases').map((item, index) => {
    const path = `cases.cases[${index}]`;
    const recordItem = record(item, path);
    return {
      ...recordItem,
      id: string(recordItem.id, `${path}.id`),
      title: string(recordItem.title, `${path}.title`),
      status: enumeration(recordItem.status, `${path}.status`, CASE_STATUSES),
    };
  });
}

export function parseGoals(value: unknown): GoalSummary[] {
  return collection(value, 'goals').map((item, index) => {
    const path = `goals.goals[${index}]`;
    const recordItem = record(item, path);
    return {
      ...recordItem,
      id: string(recordItem.id, `${path}.id`),
      title: string(recordItem.title, `${path}.title`),
      priority: enumeration(integer(recordItem.priority, `${path}.priority`), `${path}.priority`, [1, 2, 3] as const),
      status: literal(recordItem.status, `${path}.status`, 'active'),
      createdAt: string(recordItem.createdAt, `${path}.createdAt`),
    };
  });
}

export function parseMissions(value: unknown): MissionSummary[] {
  return collection(value, 'missions').map((item, index) => {
    const path = `missions.missions[${index}]`;
    const recordItem = record(item, path);
    const executionPhase = optionalEnum(recordItem.executionPhase, `${path}.executionPhase`, MISSION_PHASES);
    const attempt = optionalBoundedInteger(recordItem.attempt, `${path}.attempt`, 3);
    return {
      ...recordItem,
      id: string(recordItem.id, `${path}.id`),
      goalId: string(recordItem.goalId, `${path}.goalId`),
      status: enumeration(recordItem.status, `${path}.status`, MISSION_STATUSES),
      createdAt: string(recordItem.createdAt, `${path}.createdAt`),
      ...(executionPhase === undefined ? {} : { executionPhase }),
      ...(attempt === undefined ? {} : { attempt }),
    };
  });
}

export function parseOpportunities(value: unknown): OpportunitySummary[] {
  return collection(value, 'opportunities').map((item, index) => {
    const path = `opportunities.opportunities[${index}]`;
    const recordItem = record(item, path);
    return {
      ...recordItem,
      id: string(recordItem.id, `${path}.id`),
      title: string(recordItem.title, `${path}.title`),
      category: string(recordItem.category, `${path}.category`),
      categoryLabel: string(recordItem.categoryLabel, `${path}.categoryLabel`),
      benefitType: string(recordItem.benefitType, `${path}.benefitType`),
      sourceHost: string(recordItem.sourceHost, `${path}.sourceHost`),
      relevance: number(recordItem.relevance, `${path}.relevance`),
      nextAction: string(recordItem.nextAction, `${path}.nextAction`),
      status: enumeration(recordItem.status, `${path}.status`, OPPORTUNITY_STATUSES),
      detectedAt: string(recordItem.detectedAt, `${path}.detectedAt`),
    };
  });
}

export function parseModelForge(value: unknown): ModelForgeSummary {
  const body = envelope(value, 'modelForge');
  const forge = record(body.forge, 'modelForge.forge');
  const hardware = record(forge.hardware, 'modelForge.forge.hardware');
  const setup = record(forge.setup, 'modelForge.forge.setup');
  return {
    ...forge,
    runtime: enumeration(forge.runtime, 'modelForge.forge.runtime', ['available', 'not_detected'] as const),
    hardware: {
      ...hardware,
      ramGiB: nonNegativeNumber(hardware.ramGiB, 'modelForge.forge.hardware.ramGiB'),
      cpuCores: nonNegativeNumber(hardware.cpuCores, 'modelForge.forge.hardware.cpuCores'),
      tier: enumeration(hardware.tier, 'modelForge.forge.hardware.tier', HARDWARE_TIERS),
    },
    activeModel: nullableString(forge.activeModel, 'modelForge.forge.activeModel'),
    recommended: string(forge.recommended, 'modelForge.forge.recommended'),
    models: array(forge.models, 'modelForge.forge.models').map((model, index) => parseModel(model, `modelForge.forge.models[${index}]`)),
    setup: {
      ...setup,
      action: enumeration(setup.action, 'modelForge.forge.setup.action', ['configure', 'pull', 'install_ollama'] as const),
      command: nullableString(setup.command, 'modelForge.forge.setup.command'),
      setting: nullableString(setup.setting, 'modelForge.forge.setup.setting'),
      restartRequired: boolean(setup.restartRequired, 'modelForge.forge.setup.restartRequired'),
    },
  };
}

function parseBootstrapAction(value: unknown, path: string) {
  const action = record(value, path);
  return { ...action, id: string(action.id, `${path}.id`), label: string(action.label, `${path}.label`), recoverable: boolean(action.recoverable, `${path}.recoverable`) };
}

function parseModel(value: unknown, path: string) {
  const model = record(value, path);
  return {
    ...model,
    id: string(model.id, `${path}.id`),
    label: string(model.label, `${path}.label`),
    minRamGiB: nonNegativeNumber(model.minRamGiB, `${path}.minRamGiB`),
    tier: enumeration(model.tier, `${path}.tier`, HARDWARE_TIERS),
    uses: array(model.uses, `${path}.uses`).map((use, index) => string(use, `${path}.uses[${index}]`)),
    multilingual: boolean(model.multilingual, `${path}.multilingual`),
    compatible: boolean(model.compatible, `${path}.compatible`),
    installed: boolean(model.installed, `${path}.installed`),
    active: boolean(model.active, `${path}.active`),
  };
}

function collection(value: unknown, name: 'cases' | 'goals' | 'missions' | 'opportunities'): unknown[] {
  const body = envelope(value, name);
  return array(body[name], `${name}.${name}`);
}

function envelope(value: unknown, path: string): Record<string, unknown> {
  const body = record(value, path);
  if (body.ok !== true) throw new KernelContractError(`${path}.ok`, 'expected true');
  return body;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new KernelContractError(path, 'expected object');
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new KernelContractError(path, 'expected array');
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new KernelContractError(path, 'expected non-empty string');
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path);
}

function goalCategory(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path);
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new KernelContractError(path, 'expected boolean');
  return value;
}

function exactTrue(value: unknown, path: string): true {
  if (value !== true) throw new KernelContractError(path, 'expected true');
  return true;
}

function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new KernelContractError(path, 'expected finite number');
  return value;
}

function nonNegativeNumber(value: unknown, path: string): number {
  const result = number(value, path);
  if (result < 0) throw new KernelContractError(path, 'expected non-negative number');
  return result;
}

function integer(value: unknown, path: string): number {
  const result = nonNegativeNumber(value, path);
  if (!Number.isInteger(result)) throw new KernelContractError(path, 'expected integer');
  return result;
}

function optionalInteger(value: unknown, path: string): number | undefined {
  return value === undefined ? undefined : integer(value, path);
}

function optionalBoundedInteger(value: unknown, path: string, maximum: number): number | undefined {
  const result = optionalInteger(value, path);
  if (result !== undefined && result > maximum) throw new KernelContractError(path, `expected integer from 0 to ${maximum}`);
  return result;
}

function literal<T extends string>(value: unknown, path: string, expected: T): T {
  if (value !== expected) throw new KernelContractError(path, `expected ${expected}`);
  return expected;
}

function enumeration<T extends string | number>(value: unknown, path: string, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new KernelContractError(path, `expected one of ${values.join(', ')}`);
  return value as T;
}

function optionalEnum<T extends string>(value: unknown, path: string, values: readonly T[]): T | undefined {
  return value === undefined ? undefined : enumeration(value, path, values);
}
