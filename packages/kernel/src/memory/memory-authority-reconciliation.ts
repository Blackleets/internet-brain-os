import {
  projectMemoryAuthorityState,
  type MemoryAuthorityProjection,
} from './memory-authority-projector';
import type { MemoryAuthorityTransitionReceipt } from './memory-authority-receipt-repository';

export type MemoryAuthorityReconciliationStatus =
  | 'valid'
  | 'missing_reference'
  | 'integrity_failure'
  | 'ambiguous_chain'
  | 'migration_required';

export interface MemoryAuthorityReconciliationInput {
  readonly memoryId: string;
  readonly receipts: readonly MemoryAuthorityTransitionReceipt[];
}

export interface MemoryAuthorityReferenceCatalog {
  readonly evidenceIds?: readonly string[];
  readonly contradictionDecisionIds?: readonly string[];
  readonly admissionRecordIds?: readonly string[];
  readonly approvalDecisionIds?: readonly string[];
}

export interface MemoryAuthorityReconciliationEntry {
  readonly memoryId: string;
  readonly status: MemoryAuthorityReconciliationStatus;
  readonly reusable: boolean;
  readonly projection: MemoryAuthorityProjection;
  readonly missingReferenceIds: readonly string[];
  readonly reason: string;
}

export interface MemoryAuthorityReconciliationReport {
  readonly status: 'complete';
  readonly entries: readonly MemoryAuthorityReconciliationEntry[];
  readonly counts: Readonly<Record<MemoryAuthorityReconciliationStatus, number>>;
}

export function reconcileMemoryAuthorityAtStartup(
  inputs: readonly MemoryAuthorityReconciliationInput[],
  references: MemoryAuthorityReferenceCatalog = {},
): MemoryAuthorityReconciliationReport {
  const referenceSets = {
    evidenceIds: new Set(references.evidenceIds ?? []),
    contradictionDecisionIds: new Set(references.contradictionDecisionIds ?? []),
    admissionRecordIds: new Set(references.admissionRecordIds ?? []),
    approvalDecisionIds: new Set(references.approvalDecisionIds ?? []),
  };
  const duplicateMemoryIds = duplicates(inputs.map((input) => input.memoryId.trim()));
  const requestOwners = new Map<string, string>();
  const ambiguousRequestIds = new Set<string>();

  for (const input of inputs) {
    const memoryId = input.memoryId.trim();
    for (const receipt of input.receipts) {
      const requestId = receipt.requestId.trim();
      const owner = requestOwners.get(requestId);
      if (owner && owner !== memoryId) ambiguousRequestIds.add(requestId);
      else requestOwners.set(requestId, memoryId);
    }
  }

  const entries = inputs.map((input): MemoryAuthorityReconciliationEntry => {
    const memoryId = input.memoryId.trim();
    const projection = projectMemoryAuthorityState(memoryId, input.receipts);

    if (duplicateMemoryIds.has(memoryId)) {
      return blockedEntry(memoryId, projection, 'ambiguous_chain', 'Duplicate memory identity found during startup reconciliation.');
    }

    if (input.receipts.some((receipt) => ambiguousRequestIds.has(receipt.requestId.trim()))) {
      return blockedEntry(memoryId, projection, 'ambiguous_chain', 'A requestId is bound to more than one memory.');
    }

    if (projection.status === 'blocked') {
      if (projection.failureCode === 'INVALID_INTEGRITY') {
        return blockedEntry(memoryId, projection, 'integrity_failure', projection.message);
      }
      if (projection.failureCode === 'EMPTY_CHAIN') {
        return blockedEntry(memoryId, projection, 'migration_required', projection.message);
      }
      return blockedEntry(memoryId, projection, 'ambiguous_chain', projection.message);
    }

    const missing = collectMissingReferences(input.receipts, referenceSets);
    if (missing.length > 0) {
      return {
        memoryId,
        status: 'missing_reference',
        reusable: false,
        projection,
        missingReferenceIds: missing,
        reason: 'One or more authority receipts reference records that are not available.',
      };
    }

    return {
      memoryId,
      status: 'valid',
      reusable: projection.state === 'admitted',
      projection,
      missingReferenceIds: [],
      reason: projection.state === 'admitted'
        ? 'Authority chain is valid and the projected state is admitted.'
        : `Authority chain is valid but projected state ${projection.state} is not reusable.`,
    };
  });

  const counts: Record<MemoryAuthorityReconciliationStatus, number> = {
    valid: 0,
    missing_reference: 0,
    integrity_failure: 0,
    ambiguous_chain: 0,
    migration_required: 0,
  };
  for (const entry of entries) counts[entry.status] += 1;

  return {
    status: 'complete',
    entries: entries.map(cloneEntry),
    counts: { ...counts },
  };
}

function collectMissingReferences(
  receipts: readonly MemoryAuthorityTransitionReceipt[],
  references: {
    readonly evidenceIds: ReadonlySet<string>;
    readonly contradictionDecisionIds: ReadonlySet<string>;
    readonly admissionRecordIds: ReadonlySet<string>;
    readonly approvalDecisionIds: ReadonlySet<string>;
  },
): string[] {
  const missing = new Set<string>();
  for (const receipt of receipts) {
    for (const id of receipt.evidenceIds ?? []) if (!references.evidenceIds.has(id)) missing.add(id);
    for (const id of receipt.contradictionDecisionIds ?? []) if (!references.contradictionDecisionIds.has(id)) missing.add(id);
    for (const id of receipt.admissionRecordIds ?? []) if (!references.admissionRecordIds.has(id)) missing.add(id);
    for (const decision of receipt.approvalDecisions ?? []) {
      if (!references.approvalDecisionIds.has(decision.decisionId)) missing.add(decision.decisionId);
    }
  }
  return [...missing].sort();
}

function blockedEntry(
  memoryId: string,
  projection: MemoryAuthorityProjection,
  status: Exclude<MemoryAuthorityReconciliationStatus, 'valid' | 'missing_reference'>,
  reason: string,
): MemoryAuthorityReconciliationEntry {
  return { memoryId, status, reusable: false, projection, missingReferenceIds: [], reason };
}

function duplicates(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return duplicate;
}

function cloneEntry(entry: MemoryAuthorityReconciliationEntry): MemoryAuthorityReconciliationEntry {
  return {
    ...entry,
    projection: entry.projection.status === 'valid'
      ? { ...entry.projection, receiptIds: [...entry.projection.receiptIds] }
      : { ...entry.projection },
    missingReferenceIds: [...entry.missingReferenceIds],
  };
}
