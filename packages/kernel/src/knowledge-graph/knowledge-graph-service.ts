import type { Entity, EntityId, Relationship } from '@internet-brain-os/shared';
import type { EntityRepository } from '../entity/entity-repository';
import type { RelationshipRepository } from '../relationship/relationship-repository';
import type { EntityKnowledgeView, GoalRelevantEntity, TemporalProperty } from './knowledge-graph-contract';

export interface TemporalPropertyStore {
  transaction<T>(callback: (properties: readonly TemporalProperty[]) => Promise<T>): Promise<T>;
  write(properties: readonly TemporalProperty[]): Promise<void>;
}

export class KnowledgeGraphError extends Error {
  readonly code = 'KNOWLEDGE_GRAPH_ERROR';
  constructor(message: string) { super(message); this.name = 'KnowledgeGraphError'; }
}
export class TemporalPropertyConflictError extends KnowledgeGraphError {
  readonly code = 'TEMPORAL_PROPERTY_CONFLICT';
}

export class KnowledgeGraphService {
  constructor(
    private readonly entities: EntityRepository,
    private readonly relationships: RelationshipRepository,
    private readonly temporal: TemporalPropertyStore,
  ) {}

  async addTemporalProperty(input: TemporalProperty): Promise<TemporalProperty> {
    const property = normalize(input);
    await this.requireSubject(property);
    return this.temporal.transaction(async (properties) => {
      const existing = properties.find((candidate) => candidate.id === property.id);
      if (existing) {
        if (stableStringify(existing) !== stableStringify(property)) throw new TemporalPropertyConflictError(`Temporal property id reused with altered content: ${property.id}`);
        return cloneProperty(existing);
      }
      if (property.supersedes) {
        const previous = properties.find((candidate) => candidate.id === property.supersedes);
        if (!previous) throw new KnowledgeGraphError(`Superseded temporal property not found: ${property.supersedes}`);
        if (previous.subjectType !== property.subjectType || previous.subjectId !== property.subjectId || previous.key !== property.key) {
          throw new KnowledgeGraphError('A temporal property may only supersede the same subject and key');
        }
      }
      await this.temporal.write([...properties.map(cloneProperty), cloneProperty(property)]);
      return cloneProperty(property);
    });
  }

  async whatDoWeKnow(entityId: EntityId, at = new Date().toISOString()): Promise<EntityKnowledgeView | null> {
    requireIso(at, 'at');
    const entity = await this.entities.getById(entityId);
    if (!entity) return null;
    const relationships = await this.findRelationships(entityId);
    const temporalProperties = await this.temporal.transaction(async (properties) => activeProperties(
      properties.filter((property) => property.subjectType === 'entity' && property.subjectId === entityId), at,
    ).map(cloneProperty));
    return { entity: cloneEntity(entity), temporalProperties, relationships };
  }

  async findRelationships(entityId: EntityId): Promise<readonly Relationship[]> {
    const relationships = await this.relationships.list();
    return relationships
      .filter((relationship) => relationship.sourceEntityId === entityId || relationship.targetEntityId === entityId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(cloneRelationship);
  }

  async findGoalRelevantEntities(terms: readonly string[], limit = 20): Promise<readonly GoalRelevantEntity[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new KnowledgeGraphError('limit must be an integer between 1 and 100');
    const normalizedTerms = [...new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean))];
    if (!normalizedTerms.length) return [];
    const entities = await this.entities.list();
    return entities.map((entity) => relevance(entity, normalizedTerms))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.entityId.localeCompare(b.entityId))
      .slice(0, limit);
  }

  private async requireSubject(property: TemporalProperty): Promise<void> {
    if (property.subjectType === 'entity') {
      if (!await this.entities.getById(property.subjectId as EntityId)) throw new KnowledgeGraphError(`Entity not found: ${property.subjectId}`);
      return;
    }
    if (!await this.relationships.getById(property.subjectId as never)) throw new KnowledgeGraphError(`Relationship not found: ${property.subjectId}`);
  }
}

function normalize(input: TemporalProperty): TemporalProperty {
  const observedAt = requireIso(input.observedAt, 'observedAt');
  const validFrom = input.validFrom ? requireIso(input.validFrom, 'validFrom') : undefined;
  const expiresAt = input.expiresAt ? requireIso(input.expiresAt, 'expiresAt') : undefined;
  if (validFrom && expiresAt && Date.parse(expiresAt) <= Date.parse(validFrom)) throw new KnowledgeGraphError('expiresAt must be after validFrom');
  const evidenceIds = [...new Set(input.evidenceIds.map((id) => clean(id, 'evidenceId')))].sort();
  if (!evidenceIds.length) throw new KnowledgeGraphError('Temporal properties require Evidence');
  return {
    id: clean(input.id, 'id'), subjectType: input.subjectType, subjectId: clean(input.subjectId, 'subjectId'), key: clean(input.key, 'key'),
    value: input.value, evidenceIds, observedAt, ...(validFrom ? { validFrom } : {}), ...(expiresAt ? { expiresAt } : {}),
    ...(input.supersedes ? { supersedes: clean(input.supersedes, 'supersedes') } : {}),
  };
}

function activeProperties(properties: readonly TemporalProperty[], at: string): readonly TemporalProperty[] {
  const time = Date.parse(at);
  const active = properties.filter((property) => {
    const start = property.validFrom ? Date.parse(property.validFrom) : Date.parse(property.observedAt);
    const end = property.expiresAt ? Date.parse(property.expiresAt) : Number.POSITIVE_INFINITY;
    return start <= time && time < end;
  });
  const superseded = new Set(active.map((property) => property.supersedes).filter((id): id is string => Boolean(id)));
  return active.filter((property) => !superseded.has(property.id)).sort((a, b) => a.key.localeCompare(b.key) || b.observedAt.localeCompare(a.observedAt));
}

function relevance(entity: Entity, terms: readonly string[]): GoalRelevantEntity {
  const haystack = [entity.name, entity.type, entity.description ?? '', ...(entity.aliases ?? [])].join(' ').toLowerCase();
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  return { entityId: entity.id, score: matchedTerms.length / terms.length, matchedTerms };
}
function cloneProperty(property: TemporalProperty): TemporalProperty { return { ...property, evidenceIds: [...property.evidenceIds] }; }
function cloneEntity(entity: Entity): Entity { return { ...entity, aliases: entity.aliases ? [...entity.aliases] : undefined, properties: { ...entity.properties }, evidenceIds: [...entity.evidenceIds] }; }
function cloneRelationship(relationship: Relationship): Relationship { return { ...relationship, evidenceIds: [...relationship.evidenceIds] }; }
function clean(value: string, field: string): string { if (typeof value !== 'string' || value.trim().length === 0) throw new KnowledgeGraphError(`${field} is required`); return value.trim(); }
function requireIso(value: string, field: string): string { const result = clean(value, field); if (!Number.isFinite(Date.parse(result))) throw new KnowledgeGraphError(`${field} must be an ISO datetime`); return result; }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') { const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)); return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`; } return JSON.stringify(value); }
