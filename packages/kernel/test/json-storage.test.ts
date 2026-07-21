import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import type {
  Case,
  CaseId,
  Confidence,
  Evidence,
  EvidenceId,
  IsoDateTime,
} from '@internet-brain-os/shared';
import {
  AlreadyExistsError,
  CorruptDataError,
  JsonCaseRepository,
  JsonEvidenceRepository,
  NotFoundError,
  backupDataDirectory,
} from '../src';
import type { EvidenceRecord } from '../src';

const roots: string[] = [];
const caseId = 'case-storage-1' as CaseId;
const otherCaseId = 'case-storage-2' as CaseId;
const evidenceId = 'evidence-storage-1' as EvidenceId;
const t1 = '2026-07-19T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T11:00:00.000Z' as IsoDateTime;

async function temporaryRoot(prefix = 'internet-brain-storage-'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function makeCase(id: CaseId = caseId): Case {
  return {
    id,
    title: 'Persistent Case',
    objective: 'Verify local persistence',
    status: 'active',
    tags: ['storage'],
    createdAt: t1,
    updatedAt: t1,
  };
}

function makeEvidence(id: EvidenceId = evidenceId, linkedCaseId: CaseId = caseId): EvidenceRecord {
  const evidence: Evidence = {
    id,
    caseId: linkedCaseId,
    sourceUrl: 'https://example.com/source',
    contentType: 'webpage',
    contentHash: 'a'.repeat(64),
    summary: 'Persistent evidence',
    capturedAt: t1,
    confidence: 0.9 as Confidence,
    tags: ['storage'],
    entityIds: [],
    relationshipIds: [],
  };
  return { evidence, updatedAt: t2 };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('JSON storage adapters', () => {
  test('persist Cases and Evidence across repository instances', async () => {
    const root = await temporaryRoot();
    await new JsonCaseRepository({ dataRoot: root }).create(makeCase());
    await new JsonEvidenceRepository({ dataRoot: root }).create(makeEvidence());

    expect(await new JsonCaseRepository({ dataRoot: root }).getById(caseId)).toEqual(makeCase());
    expect(await new JsonEvidenceRepository({ dataRoot: root }).getById(evidenceId)).toEqual(makeEvidence());
  });

  test('serializes concurrent writes from separate repository instances', async () => {
    const root = await temporaryRoot();
    const first = new JsonCaseRepository({ dataRoot: root });
    const second = new JsonCaseRepository({ dataRoot: root });

    await Promise.all([
      first.create(makeCase('case-concurrent-1' as CaseId)),
      second.create(makeCase('case-concurrent-2' as CaseId)),
    ]);

    const stored = await new JsonCaseRepository({ dataRoot: root }).list();
    expect(stored.map((record) => record.id).sort()).toEqual([
      'case-concurrent-1',
      'case-concurrent-2',
    ]);
  });

  test('preserves updatedAt and filters Evidence by Case', async () => {
    const root = await temporaryRoot();
    const repository = new JsonEvidenceRepository({ dataRoot: root });
    await repository.create(makeEvidence());
    await repository.create(makeEvidence('evidence-storage-2' as EvidenceId, otherCaseId));

    const filtered = await repository.list(caseId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.updatedAt).toBe(t2);
    expect(filtered[0]?.evidence.id).toBe(evidenceId);
  });

  test('rejects duplicate creates and updates for missing records', async () => {
    const root = await temporaryRoot();
    const cases = new JsonCaseRepository({ dataRoot: root });
    const evidence = new JsonEvidenceRepository({ dataRoot: root });
    await cases.create(makeCase());
    await evidence.create(makeEvidence());

    await expect(cases.create(makeCase())).rejects.toBeInstanceOf(AlreadyExistsError);
    await expect(evidence.create(makeEvidence())).rejects.toBeInstanceOf(AlreadyExistsError);
    await expect(cases.update(makeCase('missing-case' as CaseId))).rejects.toBeInstanceOf(NotFoundError);
    await expect(evidence.update(makeEvidence('missing-evidence' as EvidenceId))).rejects.toBeInstanceOf(NotFoundError);
  });

  test('does not expose stored state through returned nested arrays', async () => {
    const root = await temporaryRoot();
    const cases = new JsonCaseRepository({ dataRoot: root });
    const evidence = new JsonEvidenceRepository({ dataRoot: root });
    await cases.create(makeCase());
    await evidence.create(makeEvidence());

    const loadedCase = await cases.getById(caseId);
    const loadedEvidence = await evidence.getById(evidenceId);
    (loadedCase?.tags as string[]).push('mutated');
    (loadedEvidence?.evidence.tags as string[]).push('mutated');

    expect((await cases.getById(caseId))?.tags).toEqual(['storage']);
    expect((await evidence.getById(evidenceId))?.evidence.tags).toEqual(['storage']);
  });

  test('fails closed when stored JSON is corrupt', async () => {
    const root = await temporaryRoot();
    await writeFile(join(root, 'cases.json'), '{not-json', 'utf8');

    await expect(new JsonCaseRepository({ dataRoot: root }).list()).rejects.toBeInstanceOf(CorruptDataError);
    expect(await readFile(join(root, 'cases.json'), 'utf8')).toBe('{not-json');
  });

  test('backs up the complete user-owned data directory', async () => {
    const root = await temporaryRoot();
    const destinationRoot = await temporaryRoot('internet-brain-backups-');
    await new JsonCaseRepository({ dataRoot: root }).create(makeCase());
    await new JsonEvidenceRepository({ dataRoot: root }).create(makeEvidence());

    const backupPath = await backupDataDirectory(root, destinationRoot);
    const backedUpCases = JSON.parse(await readFile(join(backupPath, 'cases.json'), 'utf8')) as { records: Case[] };
    const backedUpEvidence = JSON.parse(await readFile(join(backupPath, 'evidence.json'), 'utf8')) as { records: EvidenceRecord[] };

    expect(backedUpCases.records).toEqual([makeCase()]);
    expect(backedUpEvidence.records).toEqual([makeEvidence()]);
  });
});
