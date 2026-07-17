export { EntityManager } from './entity-manager';
export { EntityResolutionEngine } from './entity-resolution';
export { decideEntityResolution } from './entity-resolution-decision';
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
export type { EntityRepository } from './entity-repository';
