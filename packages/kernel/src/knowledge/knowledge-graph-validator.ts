import type { EntityId, RelationshipId } from '@internet-brain-os/shared';
import type { KnowledgeGraphSnapshot } from './knowledge-graph';

export type KnowledgeGraphIssueCode =
  | 'duplicate_entity_id'
  | 'duplicate_relationship_id'
  | 'missing_relationship_source'
  | 'missing_relationship_target'
  | 'self_relationship';

export interface KnowledgeGraphIssue {
  readonly code: KnowledgeGraphIssueCode;
  readonly message: string;
  readonly entityId?: EntityId;
  readonly relationshipId?: RelationshipId;
}

export interface KnowledgeGraphValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeGraphIssue[];
}

/** Validates graph referential integrity without mutating the graph. */
export function validateKnowledgeGraph(snapshot: KnowledgeGraphSnapshot): KnowledgeGraphValidationResult {
  const issues: KnowledgeGraphIssue[] = [];
  const entityIds = new Set<EntityId>();
  const relationshipIds = new Set<RelationshipId>();

  for (const entity of snapshot.entities) {
    if (entityIds.has(entity.id)) {
      issues.push({ code: 'duplicate_entity_id', message: `Duplicate entity id: ${entity.id}`, entityId: entity.id });
    }
    entityIds.add(entity.id);
  }

  for (const relationship of snapshot.relationships) {
    if (relationshipIds.has(relationship.id)) {
      issues.push({ code: 'duplicate_relationship_id', message: `Duplicate relationship id: ${relationship.id}`, relationshipId: relationship.id });
    }
    relationshipIds.add(relationship.id);

    if (!entityIds.has(relationship.sourceEntityId)) {
      issues.push({ code: 'missing_relationship_source', message: `Missing source entity: ${relationship.sourceEntityId}`, relationshipId: relationship.id });
    }
    if (!entityIds.has(relationship.targetEntityId)) {
      issues.push({ code: 'missing_relationship_target', message: `Missing target entity: ${relationship.targetEntityId}`, relationshipId: relationship.id });
    }
    if (relationship.sourceEntityId === relationship.targetEntityId) {
      issues.push({ code: 'self_relationship', message: `Self relationship: ${relationship.id}`, relationshipId: relationship.id });
    }
  }

  return { valid: issues.length === 0, issues };
}
