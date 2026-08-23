import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Confidence, Entity, EntityId, EvidenceId, IsoDateTime, VerificationStatus } from '@internet-brain-os/shared';
import { SqliteEntityRepository } from './sqlite-entity-repository';

const id = (value: string) => value as EntityId;
const ev = (value: string) => value as EvidenceId;
const iso = (value: string) => value as IsoDateTime;
const conf = (value: number) => value as Confidence;

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: id('acme'),
    type: 'company',
    name: 'Acme',
    aliases: ['ACME Corp'],
    properties: { sector: 'industrial' },
    verificationStatus: 'hypothesis' as VerificationStatus,
    confidence: conf(0.8),
    createdAt: iso('2026-08-21T00:00:00.000Z'),
    updatedAt: iso('2026-08-21T00:00:00.000Z'),
    evidenceIds: [ev('ev1')],
    ...overrides,
  };
}

describe('SqliteEntityRepository', () => {
  let directory: string;
  let repository: SqliteEntityRepository;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'efesto-entity-sqlite-'));
    repository = new SqliteEntityRepository(join(directory, 'entities.db'));
  });

  afterEach(async () => {
    repository.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates and retrieves an entity with all fields intact', async () => {
    const entity = makeEntity();
    await repository.create(entity);
    const loaded = await repository.getById(id('acme'));
    assert.deepEqual(loaded, entity);
  });

  it('returns null for a missing entity', async () => {
    assert.equal(await repository.getById(id('nope')), null);
  });

  it('rejects duplicate ids on create', async () => {
    await repository.create(makeEntity());
    await assert.rejects(() => repository.create(makeEntity()), /already exists/);
  });

  it('lists every stored entity', async () => {
    await repository.create(makeEntity());
    await repository.create(makeEntity({ id: id('other'), name: 'Other' }));
    const all = await repository.list();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((entity) => entity.id).sort(), [id('acme'), id('other')]);
  });

  it('updates an existing entity and reflects the change', async () => {
    await repository.create(makeEntity());
    const updated = makeEntity({
      name: 'Acme Renamed',
      verificationStatus: 'verified' as VerificationStatus,
      confidence: conf(0.95),
      aliases: ['ACME', 'Acme Corp'],
      evidenceIds: [ev('ev1'), ev('ev2')],
      properties: { sector: 'tech', hq: 'Madrid' },
    });
    await repository.update(updated);
    const loaded = await repository.getById(id('acme'));
    assert.deepEqual(loaded, updated);
  });

  it('rejects updating a missing entity', async () => {
    await assert.rejects(() => repository.update(makeEntity()), /not found/);
  });

  it('persists across connections (reopen the same file)', async () => {
    await repository.create(makeEntity());
    repository.close();
    const reopened = new SqliteEntityRepository(join(directory, 'entities.db'));
    try {
      const loaded = await reopened.getById(id('acme'));
      assert.equal(loaded?.name, 'Acme');
    } finally {
      reopened.close();
    }
  });
});
