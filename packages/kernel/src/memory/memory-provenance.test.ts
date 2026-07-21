import { describe, expect, it } from 'vitest';
import type { CaseId, Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { mergeMemoryProvenance } from './memory-provenance';
import type { Memory, MemoryId } from './memory-repository';

const t1 = '2026-07-19T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T10:01:00.000Z' as IsoDateTime;
const caseId = 'case:forensics' as CaseId;
const evidenceA = 'evidence:a' as EvidenceId;
const evidenceB = 'evidence:b' as EvidenceId;

function memory(id: string, evidenceIds: readonly EvidenceId[] = []): Memory {
  return {
    id: id as MemoryId,
    kind: 'fact',
    subject: 'Evidence chain',
    content: 'Captured evidence must keep provenance.',
    confidence: 0.8 as Confidence,
    evidenceIds,
    status: 'active',
    createdAt: t1,
    updatedAt: t1,
  };
}

describe('memory provenance', () => {
  it('records origin, timestamp, source Case, related Evidence, and provenance chain', () => {
    const canonical = memory('memory:canonical', [evidenceA]);
    const source = memory('memory:source', [evidenceA, evidenceB]);

    const result = mergeMemoryProvenance(canonical, [canonical, source], t2, {
      origin: 'memory-consolidation',
      caseIds: [caseId],
      parentProvenanceIds: ['provenance:previous'],
    });

    expect(result.memory).toEqual(canonical);
    expect(result.memory).not.toBe(canonical);
    expect(result.provenance).toEqual({
      memoryId: 'memory:canonical',
      origin: 'memory-consolidation',
      sourceMemoryIds: ['memory:canonical', 'memory:source'],
      caseIds: [caseId],
      evidenceIds: [evidenceA, evidenceB],
      parentProvenanceIds: ['provenance:previous'],
      consolidatedAt: t2,
    });
  });

  it('rejects incomplete provenance without source memories, timestamp, or origin', () => {
    const canonical = memory('memory:canonical', [evidenceA]);

    expect(() => mergeMemoryProvenance(canonical, [], t2, { origin: 'memory-consolidation' })).toThrow('source memory');
    expect(() => mergeMemoryProvenance(canonical, [canonical], '' as IsoDateTime, { origin: 'memory-consolidation' })).toThrow('timestamp');
    expect(() => mergeMemoryProvenance(canonical, [canonical], t2, { origin: ' ' })).toThrow('origin');
  });

  it('rejects manipulated provenance when canonical memory is not part of the source chain', () => {
    const canonical = memory('memory:canonical', [evidenceA]);
    const unrelated = memory('memory:unrelated', [evidenceB]);

    expect(() => mergeMemoryProvenance(canonical, [unrelated], t2, { origin: 'memory-consolidation' }))
      .toThrow('canonical memory must be included');
  });
});
