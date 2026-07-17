import type { Entity, EntityId, Relationship, RelationshipId } from '@internet-brain-os/shared';

export interface KnowledgeGraphSnapshot {
  readonly entities: readonly Entity[];
  readonly relationships: readonly Relationship[];
}

export interface KnowledgeGraphQuery {
  readonly entityId?: EntityId;
  readonly relationshipType?: string;
  readonly entityType?: string;
}

/** Read-only graph projection for traversing accumulated knowledge. */
export class KnowledgeGraph {
  constructor(private readonly snapshot: KnowledgeGraphSnapshot) {}

  findEntities(query: Pick<KnowledgeGraphQuery, 'entityType'> = {}): readonly Entity[] {
    return this.snapshot.entities.filter((entity) => !query.entityType || entity.type === query.entityType);
  }

  findRelationships(query: KnowledgeGraphQuery = {}): readonly Relationship[] {
    return this.snapshot.relationships.filter((relationship) => {
      if (query.relationshipType && relationship.type !== query.relationshipType) return false;
      if (query.entityId && relationship.sourceEntityId !== query.entityId && relationship.targetEntityId !== query.entityId) return false;
      return true;
    });
  }

  neighbors(entityId: EntityId): readonly EntityId[] {
    const ids = new Set<EntityId>();
    for (const relationship of this.findRelationships({ entityId })) {
      if (relationship.sourceEntityId === entityId) ids.add(relationship.targetEntityId);
      if (relationship.targetEntityId === entityId) ids.add(relationship.sourceEntityId);
    }
    return [...ids];
  }

  getEntity(id: EntityId): Entity | null { return this.snapshot.entities.find((entity) => entity.id === id) ?? null; }
  getRelationship(id: RelationshipId): Relationship | null { return this.snapshot.relationships.find((relationship) => relationship.id === id) ?? null; }
}
