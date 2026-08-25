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
// SqliteEntityRepository is intentionally NOT re-exported from the barrel:
// it imports node:sqlite, which Vite 5 cannot resolve (vitest-dev/vitest#7177),
// so a barrel reference would break every vitest suite importing '../src'.
// Import it directly: `import { SqliteEntityRepository } from './entity/sqlite-entity-repository'`
// (or the compiled deep path at runtime).
