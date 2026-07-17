export { EntityManager } from './entity-manager';
export { EntityResolutionEngine } from './entity-resolution';
export { decideEntityResolution } from './entity-resolution-decision';
export { InMemoryEntityResolutionRegistry } from './entity-resolution-registry';
export type { CreateEntityInput } from './entity-manager';
export type {
  EntityResolutionCandidate,
  EntityResolutionDecision as EntityResolutionMatchDecision,
  EntityResolutionInput,
  EntityResolutionOptions,
} from './entity-resolution';
export type {
  AuditableEntityResolutionDecision,
  EntityResolutionAction,
  EntityResolutionDecisionInput,
} from './entity-resolution-decision';
export type {
  EntityResolutionRecord,
  EntityResolutionRegistry,
} from './entity-resolution-registry';
export type { EntityRepository } from './entity-repository';
