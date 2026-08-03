import type { MemoryAuthorityReconciliationReport } from './memory-authority-reconciliation';

export interface MemoryRetrievalCandidate<T> {
  readonly memoryId: string;
  readonly value: T;
}

export interface MemoryRetrievalGateResult<T> {
  readonly admitted: readonly MemoryRetrievalCandidate<T>[];
  readonly excludedMemoryIds: readonly string[];
}

export function gateMemoryRetrieval<T>(
  candidates: readonly MemoryRetrievalCandidate<T>[],
  reconciliation: MemoryAuthorityReconciliationReport,
): MemoryRetrievalGateResult<T> {
  if (reconciliation.status !== 'complete') {
    return {
      admitted: [],
      excludedMemoryIds: uniqueSorted(candidates.map((candidate) => candidate.memoryId.trim())),
    };
  }

  const reusableByMemoryId = new Map<string, boolean>();
  for (const entry of reconciliation.entries) {
    const memoryId = entry.memoryId.trim();
    const reusable = entry.status === 'valid'
      && entry.reusable === true
      && entry.projection.status === 'valid'
      && entry.projection.state === 'admitted';

    if (reusableByMemoryId.has(memoryId)) {
      reusableByMemoryId.set(memoryId, false);
    } else {
      reusableByMemoryId.set(memoryId, reusable);
    }
  }

  const admitted: MemoryRetrievalCandidate<T>[] = [];
  const excluded = new Set<string>();
  const seenCandidates = new Set<string>();

  for (const candidate of candidates) {
    const memoryId = candidate.memoryId.trim();
    if (!memoryId || seenCandidates.has(memoryId) || reusableByMemoryId.get(memoryId) !== true) {
      if (memoryId) excluded.add(memoryId);
      continue;
    }

    seenCandidates.add(memoryId);
    admitted.push({ memoryId, value: candidate.value });
  }

  return {
    admitted: admitted.map((candidate) => ({ ...candidate })),
    excludedMemoryIds: [...excluded].sort(),
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
