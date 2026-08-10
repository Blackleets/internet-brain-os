import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { LocalProductCohortLedger, readLocalProductCohort } from './product-cohort.mjs';
import { join } from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('local product cohort ledger', () => {
  it('creates one idempotent local-installation cohort without a global identifier', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-product-cohort-'));
    const file = join(directory, 'store.json');
    const store = new LocalKnowledgeStore(file);
    const ledger = new LocalProductCohortLedger(store, { now: () => new Date('2026-08-11T08:00:00.000Z') });

    const created = await ledger.ensure();
    const replay = await ledger.ensure();

    expect(created).toEqual({
      status: 'valid',
      cohort: {
        schemaVersion: 'efesto.local-product-cohort.v1',
        unit: 'local_installation',
        startedAt: '2026-08-11T08:00:00.000Z',
      },
    });
    expect(replay).toEqual(created);
    const persisted = JSON.parse(await readFile(file, 'utf8'));
    expect(persisted.productCohort).toEqual(created.cohort);
    expect(Object.keys(persisted.productCohort)).toEqual(['schemaVersion', 'unit', 'startedAt']);
  });

  it('preserves malformed cohort metadata and reports it invalid instead of fabricating a cohort', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-product-cohort-invalid-'));
    const file = join(directory, 'store.json');
    const malformed = { schemaVersion: 'efesto.local-product-cohort.v1', unit: 'local_installation', startedAt: 'not-a-date' };
    await writeFile(file, `${JSON.stringify({ productCohort: malformed })}\n`, 'utf8');
    const ledger = new LocalProductCohortLedger(new LocalKnowledgeStore(file));

    expect(await ledger.ensure()).toEqual({ status: 'invalid' });
    expect(JSON.parse(await readFile(file, 'utf8')).productCohort).toEqual(malformed);
    expect(readLocalProductCohort(malformed)).toEqual({ status: 'invalid' });
  });
});
