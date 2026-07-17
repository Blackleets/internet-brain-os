import type { Claim, Entity, Relationship, RelationshipId } from '@internet-brain-os/shared';
import { KnowledgeGraph, type KnowledgeGraphSnapshot } from './knowledge-graph';

export interface ClaimKnowledgeProjection {
  readonly claim: Claim;
  readonly subject: Entity;
  readonly object: Entity;
  readonly relationship: Relationship;
}

/** Projects claims into the graph only when both endpoints are known. */
export class ClaimKnowledgeProjector {
  project(claims: readonly Claim[], entities: readonly Entity[], relationships: readonly Relationship[]): KnowledgeGraph {
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const relationshipById = new Map(relationships.map((relationship) => [relationship.id, relationship]));
    const projectedRelationships = new Map<RelationshipId, Relationship>(relationshipById);

    for (const claim of claims) {
      if (!claim.subjectEntityId || !claim.objectEntityId) continue;
      if (!entityById.has(claim.subjectEntityId) || !entityById.has(claim.objectEntityId)) continue;

      const relationshipId = `claim:${claim.id}` as RelationshipId;
      if (projectedRelationships.has(relationshipId)) continue;

      projectedRelationships.set(relationshipId, {
        id: relationshipId,
        sourceEntityId: claim.subjectEntityId,
        targetEntityId: claim.objectEntityId,
        type: 'claim_supports_relation',
        description: claim.statement,
        verificationStatus: claim.verificationStatus,
        confidence: claim.confidence,
        evidenceIds: [...claim.evidenceIds],
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
      });
    }

    const snapshot: KnowledgeGraphSnapshot = {
      entities: [...entities],
      relationships: [...projectedRelationships.values()],
    };
    return new KnowledgeGraph(snapshot);
  }
}
