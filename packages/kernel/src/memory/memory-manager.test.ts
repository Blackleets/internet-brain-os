import { describe, expect, it } from 'vitest';
import type { Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { InMemoryMemoryRepository } from '../storage/in-memory';
import { MemoryManager } from './memory-manager';
import type { MemoryId } from './memory-repository';

const t1 = '2026-07-19T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T10:01:00.000Z' as IsoDateTime;
const t3 = '2026-07-19T10:02:00.000Z' as IsoDateTime;
const memoryId = 'memory:deterministic' as MemoryId;
const evidenceA = 'evidence:a' as EvidenceId;
const evidenceB = 'evidence:b' as EvidenceId;

function manager(): MemoryManager {
  return new MemoryManager(new InMemoryMemoryRepository());
}

describe('MemoryManager lifecycle', () => {
  it('creates memories with deterministic IDs, normalized content, deduplicated evidence, and active status', async () => {
    const service = manager();

    const memory = await service.create({
      id: memoryId,
      kind: 'fact',
      subject: '  Kernel bridge  ',
      content: '  Evidence must keep provenance.  ',
      confidence: 0.8 as Confidence,
      evidenceIds: [evidenceA, evidenceA],
      createdAt: t1,
    });

    expect(memory).toMatchObject({
      id: memoryId,
      kind: 'fact',
      subject: 'Kernel bridge',
      content: 'Evidence must keep provenance.',
      confidence: 0.8,
      evidenceIds: [evidenceA],
      status: 'active',
      createdAt: t1,
      updatedAt: t1,
    });
    await expect(service.create({ ...memory, createdAt: t2 })).rejects.toMatchObject({ code: 'MEMORY_ALREADY_EXISTS' });
  });

  it('reads isolated copies and lists active memories by default', async () => {
    const service = manager();
    const created = await service.create({
      id: memoryId,
      kind: 'observation',
      subject: 'Browser capture',
      content: 'The popup can select an existing Case.',
      confidence: 0.7 as Confidence,
      evidenceIds: [evidenceA],
      createdAt: t1,
    });

    const loaded = await service.getById(created.id);
    expect(loaded).toEqual(created);
    expect(loaded).not.toBe(created);
    expect(await service.list()).toEqual([created]);
  });

  it('updates mutable fields, attaches evidence without duplicates, and rejects stale updates', async () => {
    const service = manager();
    await service.create({
      id: memoryId,
      kind: 'hypothesis',
      subject: 'Memory toxicology',
      content: 'A model summary may be contaminated.',
      confidence: 0.4 as Confidence,
      evidenceIds: [evidenceA],
      createdAt: t1,
    });

    const updated = await service.update(memoryId, {
      content: 'A local model summary may be contaminated.',
      confidence: 0.65 as Confidence,
      evidenceIds: [evidenceA, evidenceB, evidenceB],
      updatedAt: t2,
    });

    expect(updated).toMatchObject({
      content: 'A local model summary may be contaminated.',
      confidence: 0.65,
      evidenceIds: [evidenceA, evidenceB],
      updatedAt: t2,
    });
    await expect(service.attachEvidence(memoryId, evidenceB, t2)).rejects.toMatchObject({ code: 'STALE_MEMORY_UPDATE' });
  });

  it('archives memories as an explicit deletion lifecycle and hides them from default reads', async () => {
    const service = manager();
    await service.create({
      id: memoryId,
      kind: 'lesson',
      subject: 'Old rule',
      content: 'This rule was superseded.',
      confidence: 0.3 as Confidence,
      createdAt: t1,
    });

    const archived = await service.archive(memoryId, t2);

    expect(archived.status).toBe('archived');
    expect(await service.getById(memoryId)).toBeNull();
    expect(await service.getById(memoryId, { includeArchived: true })).toEqual(archived);
    expect(await service.list()).toEqual([]);
    expect(await service.list({ includeArchived: true })).toEqual([archived]);
    await expect(service.update(memoryId, { content: 'mutated', updatedAt: t3 })).rejects.toMatchObject({ code: 'ARCHIVED_MEMORY_MUTATION' });
  });

  it('rejects invalid lifecycle inputs and unknown memories without persisting partial records', async () => {
    const service = manager();

    await expect(service.create({
      id: 'memory:bad' as MemoryId,
      kind: 'fact',
      subject: ' ',
      content: 'Valid content',
      confidence: 0.5 as Confidence,
      createdAt: t1,
    })).rejects.toMatchObject({ code: 'INVALID_MEMORY_INPUT', field: 'subject' });

    await expect(service.create({
      id: 'memory:bad-confidence' as MemoryId,
      kind: 'fact',
      subject: 'Subject',
      content: 'Valid content',
      confidence: 1.5 as Confidence,
      createdAt: t1,
    })).rejects.toMatchObject({ code: 'INVALID_MEMORY_INPUT', field: 'confidence' });

    await expect(service.update(memoryId, { content: 'missing', updatedAt: t2 })).rejects.toMatchObject({ code: 'MEMORY_NOT_FOUND' });
    expect(await service.list({ includeArchived: true })).toEqual([]);
  });
});
