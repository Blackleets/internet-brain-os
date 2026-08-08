import { describe, expect, test } from 'vitest';
import type { Confidence, EntityId, EvidenceId, IsoDateTime, RelationshipId } from '@internet-brain-os/shared';
import { EntityManager } from '../entity/entity-manager';
import { RelationshipManager } from '../relationship/relationship-manager';
import { InMemoryEntityRepository, InMemoryRelationshipRepository } from '../storage/in-memory';
import { KnowledgeGraphError, KnowledgeGraphService, TemporalPropertyConflictError, type TemporalPropertyStore } from './knowledge-graph-service';
import type { TemporalProperty } from './knowledge-graph-contract';

function temporalStore(): TemporalPropertyStore {
  let properties: TemporalProperty[] = [];
  return { transaction: async (callback) => callback(properties), write: async (next) => { properties = next.map((property) => ({ ...property, evidenceIds: [...property.evidenceIds] })); } };
}
const at = '2026-08-08T15:00:00.000Z' as IsoDateTime;
const confidence = 0.9 as Confidence;
const entity1 = 'entity:drill' as EntityId;
const entity2 = 'entity:store' as EntityId;
const relationship = 'relationship:sold-by' as RelationshipId;
const evidence = 'evidence:offer' as EvidenceId;

async function fixture() {
  const entities = new InMemoryEntityRepository();
  const relationships = new InMemoryRelationshipRepository();
  const entityManager = new EntityManager(entities);
  const relationshipManager = new RelationshipManager(relationships);
  await entityManager.create({ id: entity1, type: 'product', name: 'Quality Cordless Drill', aliases: ['drill'], confidence, createdAt: at, evidenceIds: [evidence] });
  await entityManager.create({ id: entity2, type: 'merchant', name: 'Example Tools', confidence, createdAt: at, evidenceIds: [evidence] });
  await relationshipManager.create({ id: relationship, type: 'sold_by', sourceEntityId: entity1, targetEntityId: entity2, confidence, createdAt: at, evidenceIds: [evidence] });
  return new KnowledgeGraphService(entities, relationships, temporalStore());
}

function price(overrides: Partial<TemporalProperty> = {}): TemporalProperty {
  return { id: 'fact:price:1', subjectType: 'entity', subjectId: entity1, key: 'price_eur', value: 22.99, evidenceIds: [evidence], observedAt: at, ...overrides };
}

describe('KnowledgeGraphService', () => {
  test('projects entity knowledge with relationships and active temporal facts', async () => {
    const graph = await fixture();
    await graph.addTemporalProperty(price());
    const view = await graph.whatDoWeKnow(entity1, '2026-08-08T15:30:00.000Z');
    expect(view?.entity.name).toBe('Quality Cordless Drill');
    expect(view?.relationships).toHaveLength(1);
    expect(view?.temporalProperties).toMatchObject([{ key: 'price_eur', value: 22.99 }]);
  });

  test('superseded and expired facts do not appear as current knowledge', async () => {
    const graph = await fixture();
    await graph.addTemporalProperty(price({ expiresAt: '2026-08-08T17:00:00.000Z' }));
    await graph.addTemporalProperty(price({ id: 'fact:price:2', value: 19.99, observedAt: '2026-08-08T16:00:00.000Z', validFrom: '2026-08-08T16:00:00.000Z', supersedes: 'fact:price:1' }));
    expect((await graph.whatDoWeKnow(entity1, '2026-08-08T16:30:00.000Z'))?.temporalProperties.map((fact) => fact.value)).toEqual([19.99]);
    expect((await graph.whatDoWeKnow(entity1, '2026-08-08T18:00:00.000Z'))?.temporalProperties.map((fact) => fact.value)).toEqual([19.99]);
  });

  test('temporal facts require Evidence and a real subject', async () => {
    const graph = await fixture();
    await expect(graph.addTemporalProperty(price({ evidenceIds: [] }))).rejects.toThrow(KnowledgeGraphError);
    await expect(graph.addTemporalProperty(price({ id: 'fact:missing', subjectId: 'entity:missing' }))).rejects.toThrow(KnowledgeGraphError);
  });

  test('exact fact replay is idempotent while altered replay fails closed', async () => {
    const graph = await fixture();
    const fact = price();
    await graph.addTemporalProperty(fact);
    await expect(graph.addTemporalProperty(fact)).resolves.toEqual(fact);
    await expect(graph.addTemporalProperty({ ...fact, value: 1 })).rejects.toThrow(TemporalPropertyConflictError);
  });

  test('finds Goal-relevant entities deterministically', async () => {
    const graph = await fixture();
    const relevant = await graph.findGoalRelevantEntities(['drill', 'cordless']);
    expect(relevant[0]).toMatchObject({ entityId: entity1, score: 1 });
  });
});
