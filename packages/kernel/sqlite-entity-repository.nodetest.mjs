import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteEntityRepository } from '../../dist-sqlite-test/packages/kernel/src/entity/sqlite-entity-repository.js';

const id = (value) => value;
const ev = (value) => value;

function makeEntity(overrides = {}) {
  return {
    id: id('acme'),
    type: 'company',
    name: 'Acme',
    aliases: ['ACME Corp'],
    properties: { sector: 'industrial' },
    verificationStatus: 'hypothesis',
    confidence: 0.8,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    evidenceIds: [ev('ev1')],
    ...overrides,
  };
}

describe('SqliteEntityRepository', () => {
  let directory;
  let repository;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'efesto-entity-sqlite-'));
    repository = new SqliteEntityRepository(join(directory, 'entities.db'));
  });

  afterEach(async () => {
    try { repository.close(); } catch { /* already closed by a reopen test */ }
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
  });

  it('updates an existing entity and reflects the change', async () => {
    await repository.create(makeEntity());
    const updated = makeEntity({
      name: 'Acme Renamed',
      verificationStatus: 'verified',
      confidence: 0.95,
      aliases: ['ACME', 'Acme Corp'],
      evidenceIds: [ev('ev1'), ev('ev2')],
      properties: { sector: 'tech', hq: 'Madrid' },
    });
    await repository.update(updated);
    assert.deepEqual(await repository.getById(id('acme')), updated);
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
      assert.equal(loaded.name, 'Acme');
      reopened.close();
    } catch (error) {
      // The afterEach hook closes `repository`; a second close on an
      // already-closed handle would mask the real result, so guard here.
      try { reopened.close(); } catch { /* already closed */ }
      throw error;
    }
  });
});
