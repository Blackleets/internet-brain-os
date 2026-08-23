import { describe, expect, it } from 'vitest';
import type { Confidence, Entity, EntityId, EvidenceId, IsoDateTime, VerificationStatus } from '@internet-brain-os/shared';
import { EntityManager } from './entity-manager';
import type { EntityRepository } from './entity-repository';

function makeRepo(): EntityRepository & { store: Map<string, Entity> } {
  const store = new Map<string, Entity>();
  return {
    store,
    async create(entity) {
      if (store.has(entity.id)) throw new Error(`Entity already exists: ${entity.id}`);
      store.set(entity.id, entity);
    },
    async getById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async update(entity) {
      if (!store.has(entity.id)) throw new Error(`Entity not found: ${entity.id}`);
      store.set(entity.id, entity);
    },
  };
}

const id = (value: string) => value as EntityId;
const ev = (value: string) => value as EvidenceId;
const iso = (value: string) => value as IsoDateTime;
const conf = (value: number) => value as Confidence;

function seed(repo: EntityRepository & { store: Map<string, Entity> }): void {
  repo.store.set(
    id('acme'),
    {
      id: id('acme'),
      type: 'company',
      name: 'Acme',
      aliases: [],
      properties: {},
      verificationStatus: 'hypothesis' as VerificationStatus,
      confidence: conf(0.8),
      createdAt: iso('2026-08-21T00:00:00.000Z'),
      updatedAt: iso('2026-08-21T00:00:00.000Z'),
      evidenceIds: [],
    }
  );
}

describe('EntityManager verification', () => {
  it('verifies an entity by linking evidence', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    const updated = await mgr.verify(id('acme'), ev('ev1'), iso('2026-08-22T00:00:00.000Z'));
    expect(updated.verificationStatus).toBe('verified');
    expect(updated.evidenceIds).toContain(ev('ev1'));
  });

  it('unverifies when the last evidence is removed', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    await mgr.verify(id('acme'), ev('ev1'), iso('2026-08-22T00:00:00.000Z'));
    const updated = await mgr.unverify(id('acme'), ev('ev1'), iso('2026-08-23T00:00:00.000Z'));
    expect(updated.evidenceIds).not.toContain(ev('ev1'));
    expect(updated.verificationStatus).toBe('hypothesis');
  });

  it('stays verified while other evidence remains after unverify', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    await mgr.verify(id('acme'), ev('ev1'), iso('2026-08-22T00:00:00.000Z'));
    await mgr.verify(id('acme'), ev('ev2'), iso('2026-08-22T01:00:00.000Z'));
    const updated = await mgr.unverify(id('acme'), ev('ev1'), iso('2026-08-23T00:00:00.000Z'));
    expect(updated.evidenceIds).toContain(ev('ev2'));
    expect(updated.verificationStatus).toBe('verified');
  });

  it('rejects verify for a missing entity', async () => {
    const repo = makeRepo();
    const mgr = new EntityManager(repo);
    await expect(mgr.verify(id('nope'), ev('ev1'), iso('2026-08-22T00:00:00.000Z'))).rejects.toThrow(
      /Entity not found/
    );
  });
});

describe('EntityManager aliases', () => {
  it('adds and removes aliases', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    const added = await mgr.addAlias(id('acme'), 'ACME', iso('2026-08-22T00:00:00.000Z'));
    expect(added.aliases).toContain('ACME');
    await expect(
      mgr.addAlias(id('acme'), 'ACME', iso('2026-08-22T00:00:00.000Z'))
    ).rejects.toThrow(/Duplicate alias/);
    const removed = await mgr.removeAlias(id('acme'), 'ACME', iso('2026-08-23T00:00:00.000Z'));
    expect(removed.aliases).not.toContain('ACME');
  });

  it('rejects removing a missing alias', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    await expect(
      mgr.removeAlias(id('acme'), 'NOPE', iso('2026-08-22T00:00:00.000Z'))
    ).rejects.toThrow(/Alias not found/);
  });
});

describe('EntityManager confidence', () => {
  it('updates confidence within range', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    const updated = await mgr.updateConfidence(id('acme'), conf(0.5), iso('2026-08-22T00:00:00.000Z'));
    expect(updated.confidence).toBe(conf(0.5));
  });

  it('rejects confidence out of range', async () => {
    const repo = makeRepo();
    seed(repo);
    const mgr = new EntityManager(repo);
    await expect(
      mgr.updateConfidence(id('acme'), conf(2), iso('2026-08-22T00:00:00.000Z'))
    ).rejects.toThrow(/confidence must be between 0 and 1/);
  });
});
