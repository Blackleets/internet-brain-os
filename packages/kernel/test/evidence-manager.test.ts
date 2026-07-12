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
import {
  ArchivedCaseEvidenceLinkError,
  CaseNotFoundError,
  EvidenceAlreadyExistsError,
  EvidenceManager,
  EvidenceNotFoundError,
  InvalidEvidenceInputError,
  StaleEvidenceUpdateError,
} from '../src';
import type { EvidenceCaseReader } from '../src';
import { InMemoryEvidenceRepository } from './in-memory-evidence-repository';

const evidenceId = 'evidence-1' as EvidenceId;
const caseId = 'case-1' as CaseId;
const entityId = 'entity-1' as EntityId;
const relationshipId = 'relationship-1' as RelationshipId;
const t1 = '2026-07-12T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-12T11:00:00.000Z' as IsoDateTime;
const t3 = '2026-07-12T12:00:00.000Z' as IsoDateTime;
const confidence = 0.8 as Confidence;
const hash = 'A'.repeat(64);

class CaseReader implements EvidenceCaseReader {
  constructor(private readonly cases: readonly Case[]) {}
  async getById(id: CaseId): Promise<Case | null> {
    return this.cases.find((item) => item.id === id) ?? null;
  }
}

function makeCase(status: Case['status'] = 'active'): Case {
  return {
    id: caseId,
    title: 'Case',
    objective: 'Objective',
    status,
    tags: [],
    createdAt: t1,
    updatedAt: t1,
  };
}

function manager(status: Case['status'] = 'active'): EvidenceManager {
  return new EvidenceManager(
    new InMemoryEvidenceRepository(),
    new CaseReader([makeCase(status)]),
  );
}

function input() {
  return {
    id: evidenceId,
    caseId,
    sourceUrl: 'https://example.com',
    contentType: 'webpage' as const,
    contentHash: hash,
    summary: '  useful source  ',
    capturedAt: t1,
    confidence,
    tags: [' research ', '', 'research'],
    entityIds: [entityId, entityId],
    relationshipIds: [relationshipId, relationshipId],
  };
}

describe('EvidenceManager', () => {
  test('creates normalized evidence and preserves immutable capture fields', async () => {
    const created = await manager().create(input());
    expect(created.sourceUrl).toBe('https://example.com/');
    expect(created.contentHash).toBe('a'.repeat(64));
    expect(created.summary).toBe('useful source');
    expect(created.tags).toEqual(['research']);
    expect(created.entityIds).toEqual([entityId]);
    expect(created.relationshipIds).toEqual([relationshipId]);
    expect(created.capturedAt).toBe(t1);
    expect(created.contentType).toBe('webpage');
  });

  test('allows evidence without a source URL or Case', async () => {
    const service = new EvidenceManager(
      new InMemoryEvidenceRepository(),
      new CaseReader([]),
    );
    const created = await service.create({
      id: evidenceId,
      contentType: 'manual',
      capturedAt: t1,
      confidence,
    });
    expect(created.sourceUrl).toBeUndefined();
    expect(created.caseId).toBeUndefined();
    expect(created.tags).toEqual([]);
  });

  test('rejects duplicate IDs', async () => {
    const service = manager();
    await service.create(input());
    await expect(service.create(input())).rejects.toBeInstanceOf(
      EvidenceAlreadyExistsError,
    );
  });

  test('rejects invalid URLs, hashes, and confidence values', async () => {
    await expect(
      manager().create({ ...input(), sourceUrl: 'ftp://example.com' }),
    ).rejects.toBeInstanceOf(InvalidEvidenceInputError);
    await expect(
      manager().create({ ...input(), contentHash: 'bad' }),
    ).rejects.toBeInstanceOf(InvalidEvidenceInputError);
    await expect(
      manager().create({ ...input(), confidence: 2 as Confidence }),
    ).rejects.toBeInstanceOf(InvalidEvidenceInputError);
  });

  test('returns null for missing evidence and errors on missing mutations', async () => {
    const service = manager();
    expect(await service.getById(evidenceId)).toBeNull();
    await expect(
      service.updateMetadata(evidenceId, { summary: 'x', updatedAt: t2 }),
    ).rejects.toBeInstanceOf(EvidenceNotFoundError);
  });

  test('updates metadata while preserving capture fields', async () => {
    const service = manager();
    const original = await service.create(input());
    const updated = await service.updateMetadata(evidenceId, {
      summary: ' updated ',
      tags: ['new'],
      updatedAt: t2,
    });
    expect(updated.summary).toBe('updated');
    expect(updated.tags).toEqual(['new']);
    expect(updated.capturedAt).toBe(original.capturedAt);
    expect(updated.contentHash).toBe(original.contentHash);
    expect(updated.contentType).toBe(original.contentType);
  });

  test('rejects stale updates', async () => {
    const service = manager();
    await service.create(input());
    await expect(
      service.updateMetadata(evidenceId, { summary: 'x', updatedAt: t1 }),
    ).rejects.toBeInstanceOf(StaleEvidenceUpdateError);
  });

  test('links and unlinks entities and relationships without duplicates', async () => {
    const service = manager();
    await service.create({ ...input(), entityIds: [], relationshipIds: [] });
    await service.linkEntity(evidenceId, entityId, t2);
    await service.linkEntity(evidenceId, entityId, t3);
    const relationshipTime = '2026-07-12T13:00:00.000Z' as IsoDateTime;
    await service.linkRelationship(evidenceId, relationshipId, relationshipTime);
    const found = await service.getById(evidenceId);
    expect(found?.entityIds).toEqual([entityId]);
    expect(found?.relationshipIds).toEqual([relationshipId]);
  });

  test('rejects links to archived or missing Cases', async () => {
    await expect(manager('archived').create(input())).rejects.toBeInstanceOf(
      ArchivedCaseEvidenceLinkError,
    );
    const service = new EvidenceManager(
      new InMemoryEvidenceRepository(),
      new CaseReader([]),
    );
    await expect(service.create(input())).rejects.toBeInstanceOf(
      CaseNotFoundError,
    );
  });

  test('lists evidence by Case', async () => {
    const service = manager();
    await service.create(input());
    expect(await service.list(caseId)).toHaveLength(1);
    expect(await service.list('other' as CaseId)).toHaveLength(0);
  });

  test('returned records and arrays do not expose repository state', async () => {
    const repository = new InMemoryEvidenceRepository();
    const service = new EvidenceManager(repository, new CaseReader([makeCase()]));
    const created = await service.create(input());
    (created.tags as string[]).push('mutated');
    const listed = (await service.list()) as unknown as Array<{ tags: string[] }>;
    listed[0]?.tags.push('changed');
    listed.push({ tags: [] });
    const stored = await service.getById(evidenceId);
    expect(stored?.tags).toEqual(['research']);
    expect(await service.list()).toHaveLength(1);
  });
});
