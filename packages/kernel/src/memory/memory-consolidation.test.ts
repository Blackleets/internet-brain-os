import { describe, expect, it } from 'vitest';
import type { Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { MemoryConsolidationEngine } from './memory-consolidation';
import { mergeMemoryProvenance } from './memory-provenance';
import type { Memory, MemoryId } from './memory-repository';

const t1 = '2026-07-19T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T10:01:00.000Z' as IsoDateTime;
const t3 = '2026-07-19T10:02:00.000Z' as IsoDateTime;

function memory(id: string, overrides: Partial<Memory> = {}): Memory {
  return {
    id: id as MemoryId,
    kind: 'fact',
    subject: 'Hermes bridge',
    content: 'Accepted captures become Evidence.',
    confidence: 0.6 as Confidence,
    evidenceIds: [],
    status: 'active',
    createdAt: t1,
    updatedAt: t1,
    ...overrides,
  };
}

describe('MemoryConsolidationEngine', () => {
  it('combines related normalized memories deterministically and traces originals', () => {
    const first = memory('memory:a', { evidenceIds: ['evidence:a' as EvidenceId], confidence: 0.6 as Confidence, updatedAt: t1 });
    const second = memory('memory:b', { content: ' accepted captures become evidence ', evidenceIds: ['evidence:b' as EvidenceId], confidence: 0.9 as Confidence, updatedAt: t2 });

    const [group] = new MemoryConsolidationEngine().consolidate([first, second]);

    expect(group).toEqual({
      canonical: second,
      sourceMemoryIds: ['memory:a', 'memory:b'],
    });
    expect(mergeMemoryProvenance(group.canonical, [first, second], t3).provenance).toMatchObject({
      memoryId: 'memory:b',
      sourceMemoryIds: ['memory:a', 'memory:b'],
      evidenceIds: ['evidence:a', 'evidence:b'],
    });
  });

  it('deduplicates repeated memory IDs and evidence IDs without mutating sources', () => {
    const first = memory('memory:a', { evidenceIds: ['evidence:a' as EvidenceId, 'evidence:a' as EvidenceId] });
    const duplicate = memory('memory:a', { confidence: 0.8 as Confidence, evidenceIds: ['evidence:a' as EvidenceId] });

    const [group] = new MemoryConsolidationEngine().consolidate([first, duplicate]);
    const provenance = mergeMemoryProvenance(group.canonical, [first, duplicate], t2).provenance;

    expect(group.sourceMemoryIds).toEqual(['memory:a']);
    expect(provenance.evidenceIds).toEqual(['evidence:a']);
    expect(first.evidenceIds).toEqual(['evidence:a', 'evidence:a']);
  });

  it('does not consolidate conflicting memories with different subject or kind', () => {
    const bridge = memory('memory:bridge', { subject: 'Hermes bridge' });
    const toxicology = memory('memory:toxicology', { subject: 'Memory toxicology' });
    const decision = memory('memory:decision', { kind: 'decision' });

    const groups = new MemoryConsolidationEngine().consolidate([bridge, toxicology, decision]);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.sourceMemoryIds)).toEqual([
      ['memory:bridge'],
      ['memory:toxicology'],
      ['memory:decision'],
    ]);
  });

  it('prefers the latest memory only when confidence is tied', () => {
    const older = memory('memory:older', { confidence: 0.7 as Confidence, updatedAt: t1 });
    const newer = memory('memory:newer', { confidence: 0.7 as Confidence, updatedAt: t2 });

    const [group] = new MemoryConsolidationEngine().consolidate([older, newer]);

    expect(group.canonical.id).toBe('memory:newer');
  });
});
