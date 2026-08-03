import { describe, expect, it } from 'vitest';
import { gateMemoryRetrieval } from './memory-retrieval-gate';
import type { MemoryAuthorityReconciliationReport } from './memory-authority-reconciliation';

function report(entries: MemoryAuthorityReconciliationReport['entries']): MemoryAuthorityReconciliationReport {
  return {
    status: 'complete',
    entries,
    counts: {
      valid: entries.filter((entry) => entry.status === 'valid').length,
      missing_reference: entries.filter((entry) => entry.status === 'missing_reference').length,
      integrity_failure: entries.filter((entry) => entry.status === 'integrity_failure').length,
      ambiguous_chain: entries.filter((entry) => entry.status === 'ambiguous_chain').length,
      migration_required: entries.filter((entry) => entry.status === 'migration_required').length,
    },
  };
}

function entry(memoryId: string, state: 'admitted' | 'quarantined', overrides = {}) {
  return {
    memoryId,
    status: 'valid' as const,
    reusable: state === 'admitted',
    projection: {
      status: 'valid' as const,
      memoryId,
      state,
      revision: 1,
      receiptIds: [`receipt-${memoryId}`],
    },
    missingReferenceIds: [],
    reason: 'test',
    ...overrides,
  };
}

describe('gateMemoryRetrieval', () => {
  it('returns only valid admitted memories', () => {
    const result = gateMemoryRetrieval(
      [
        { memoryId: 'memory-1', value: { text: 'safe' } },
        { memoryId: 'memory-2', value: { text: 'blocked' } },
      ],
      report([entry('memory-1', 'admitted'), entry('memory-2', 'quarantined')]),
    );

    expect(result.admitted).toEqual([{ memoryId: 'memory-1', value: { text: 'safe' } }]);
    expect(result.excludedMemoryIds).toEqual(['memory-2']);
  });

  it('excludes a memory when reconciliation is invalid even if reusable is forged true', () => {
    const invalid = entry('memory-1', 'admitted', {
      status: 'integrity_failure' as const,
      reusable: true,
    });

    expect(gateMemoryRetrieval([{ memoryId: 'memory-1', value: 'unsafe' }], report([invalid]))).toEqual({
      admitted: [],
      excludedMemoryIds: ['memory-1'],
    });
  });

  it('excludes duplicate reconciliation identities and duplicate candidates', () => {
    const reconciliation = report([entry('memory-1', 'admitted'), entry('memory-1', 'admitted')]);
    const result = gateMemoryRetrieval(
      [
        { memoryId: 'memory-1', value: 'first' },
        { memoryId: 'memory-1', value: 'second' },
      ],
      reconciliation,
    );

    expect(result.admitted).toEqual([]);
    expect(result.excludedMemoryIds).toEqual(['memory-1']);
  });

  it('excludes candidates missing from reconciliation', () => {
    const result = gateMemoryRetrieval(
      [{ memoryId: 'unknown-memory', value: 'unknown' }],
      report([]),
    );

    expect(result.admitted).toEqual([]);
    expect(result.excludedMemoryIds).toEqual(['unknown-memory']);
  });

  it('returns defensive candidate wrappers', () => {
    const candidate = { memoryId: 'memory-1', value: { text: 'safe' } };
    const result = gateMemoryRetrieval([candidate], report([entry('memory-1', 'admitted')]));

    expect(result.admitted[0]).not.toBe(candidate);
    expect(result.admitted[0]).toEqual(candidate);
  });
});
