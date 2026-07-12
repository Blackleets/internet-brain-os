import { describe, expect, test } from 'vitest';
import type {
  Case,
  CaseId,
  Confidence,
  EntityId,
  EvidenceId,
  IsoDateTime,
  RelationshipId,
} from '@internet-brain-os/shared';
import { ArchivedCaseEvidenceLinkError, EvidenceManager } from '../src';
import type { EvidenceCaseReader } from '../src';
import { InMemoryEvidenceRepository } from './in-memory-evidence-repository';

const evidenceId = 'evidence-link-tests' as EvidenceId;
const caseId = 'case-active' as CaseId;
const archivedCaseId = 'case-archived' as CaseId;
const entityId = 'entity-link-tests' as EntityId;
const relationshipId = 'relationship-link-tests' as RelationshipId;
const t1 = '2026-07-12T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-12T11:00:00.000Z' as IsoDateTime;
const t3 = '2026-07-12T12:00:00.000Z' as IsoDateTime;
const t4 = '2026-07-12T13:00:00.000Z' as IsoDateTime;
const t5 = '2026-07-12T14:00:00.000Z' as IsoDateTime;
const t6 = '2026-07-12T15:00:00.000Z' as IsoDateTime;

function makeCase(id: CaseId, status: Case['status']): Case {
  return { id, title: 'Case', objective: 'Objective', status, tags: [], createdAt: t1, updatedAt: t1 };
}

class CaseReader implements EvidenceCaseReader {
  private readonly cases = [
    makeCase(caseId, 'active'),
    makeCase(archivedCaseId, 'archived'),
  ];
  async getById(id: CaseId): Promise<Case | null> {
    return this.cases.find((item) => item.id === id) ?? null;
  }
}

function createManager(): EvidenceManager {
  return new EvidenceManager(new InMemoryEvidenceRepository(), new CaseReader());
}

async function createDetached(service: EvidenceManager): Promise<void> {
  await service.create({
    id: evidenceId,
    contentType: 'manual',
    capturedAt: t1,
    confidence: 0.8 as Confidence,
  });
}

describe('EvidenceManager links', () => {
  test('links and unlinks Entities and Relationships', async () => {
    const service = createManager();
    await createDetached(service);

    await service.linkEntity(evidenceId, entityId, t2);
    await service.linkRelationship(evidenceId, relationshipId, t3);
    expect((await service.getById(evidenceId))?.entityIds).toEqual([entityId]);
    expect((await service.getById(evidenceId))?.relationshipIds).toEqual([relationshipId]);

    await service.unlinkEntity(evidenceId, entityId, t4);
    await service.unlinkRelationship(evidenceId, relationshipId, t5);
    expect((await service.getById(evidenceId))?.entityIds).toEqual([]);
    expect((await service.getById(evidenceId))?.relationshipIds).toEqual([]);
  });

  test('attaches and detaches a Case explicitly', async () => {
    const service = createManager();
    await createDetached(service);

    expect((await service.attachToCase(evidenceId, caseId, t2)).caseId).toBe(caseId);
    expect((await service.detachFromCase(evidenceId, t3)).caseId).toBeUndefined();
  });

  test('rejects explicit attachment to an archived Case', async () => {
    const service = createManager();
    await createDetached(service);

    await expect(
      service.attachToCase(evidenceId, archivedCaseId, t6),
    ).rejects.toBeInstanceOf(ArchivedCaseEvidenceLinkError);
  });
});
