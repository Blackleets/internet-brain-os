import {
  allowedMemoryAuthorityTransitions,
  isTerminalMemoryAuthorityState,
  type MemoryAuthorityState,
} from './memory-authority-lifecycle';
import {
  verifyMemoryAuthorityReceiptIntegrity,
  type MemoryAuthorityTransitionReceipt,
} from './memory-authority-receipt-repository';

export type MemoryAuthorityProjectionFailureCode =
  | 'EMPTY_CHAIN'
  | 'CROSS_MEMORY_RECEIPT'
  | 'INVALID_INTEGRITY'
  | 'INVALID_REVISION'
  | 'REVISION_GAP'
  | 'STATE_MISMATCH'
  | 'INVALID_TRANSITION'
  | 'TERMINAL_CONTINUATION'
  | 'MISSING_POLICY_VERSION';

export interface ValidMemoryAuthorityProjection {
  readonly status: 'valid';
  readonly memoryId: string;
  readonly state: MemoryAuthorityState;
  readonly revision: number;
  readonly receiptIds: readonly string[];
}

export interface BlockedMemoryAuthorityProjection {
  readonly status: 'blocked';
  readonly memoryId: string;
  readonly failureCode: MemoryAuthorityProjectionFailureCode;
  readonly failedReceiptId?: string;
  readonly message: string;
}

export type MemoryAuthorityProjection =
  | ValidMemoryAuthorityProjection
  | BlockedMemoryAuthorityProjection;

export function projectMemoryAuthorityState(
  memoryId: string,
  receipts: readonly MemoryAuthorityTransitionReceipt[],
): MemoryAuthorityProjection {
  const normalizedMemoryId = memoryId.trim();

  if (receipts.length === 0) {
    return blocked(normalizedMemoryId, 'EMPTY_CHAIN', 'Authority cannot be reconstructed from an empty receipt chain.');
  }

  let projectedState: MemoryAuthorityState | undefined;
  let projectedRevision = 0;
  const receiptIds: string[] = [];

  for (const receipt of receipts) {
    if (receipt.memoryId !== normalizedMemoryId) {
      return blocked(
        normalizedMemoryId,
        'CROSS_MEMORY_RECEIPT',
        'The receipt chain contains a receipt belonging to another memory.',
        receipt.receiptId,
      );
    }

    if (!verifyMemoryAuthorityReceiptIntegrity(receipt)) {
      return blocked(
        normalizedMemoryId,
        'INVALID_INTEGRITY',
        'Receipt integrity verification failed.',
        receipt.receiptId,
      );
    }

    if (!receipt.policyVersion.trim()) {
      return blocked(
        normalizedMemoryId,
        'MISSING_POLICY_VERSION',
        'Every authority receipt must bind to a policy version.',
        receipt.receiptId,
      );
    }

    if (!Number.isSafeInteger(receipt.expectedRevision)
      || !Number.isSafeInteger(receipt.resultingRevision)
      || receipt.expectedRevision < 0
      || receipt.resultingRevision !== receipt.expectedRevision + 1) {
      return blocked(
        normalizedMemoryId,
        'INVALID_REVISION',
        'Receipt revisions are not valid consecutive safe integers.',
        receipt.receiptId,
      );
    }

    if (receipt.expectedRevision !== projectedRevision) {
      return blocked(
        normalizedMemoryId,
        'REVISION_GAP',
        `Expected chain revision ${projectedRevision}, received ${receipt.expectedRevision}.`,
        receipt.receiptId,
      );
    }

    if (projectedState !== undefined) {
      if (isTerminalMemoryAuthorityState(projectedState)) {
        return blocked(
          normalizedMemoryId,
          'TERMINAL_CONTINUATION',
          `Terminal state ${projectedState} cannot have a later authority receipt.`,
          receipt.receiptId,
        );
      }

      if (receipt.from !== projectedState) {
        return blocked(
          normalizedMemoryId,
          'STATE_MISMATCH',
          `Receipt starts from ${receipt.from}, but the projected state is ${projectedState}.`,
          receipt.receiptId,
        );
      }
    }

    if (!allowedMemoryAuthorityTransitions(receipt.from).includes(receipt.to)) {
      return blocked(
        normalizedMemoryId,
        'INVALID_TRANSITION',
        `Transition ${receipt.from} -> ${receipt.to} is not allowed by the authority lifecycle.`,
        receipt.receiptId,
      );
    }

    projectedState = receipt.to;
    projectedRevision = receipt.resultingRevision;
    receiptIds.push(receipt.receiptId);
  }

  return {
    status: 'valid',
    memoryId: normalizedMemoryId,
    state: projectedState!,
    revision: projectedRevision,
    receiptIds: [...receiptIds],
  };
}

function blocked(
  memoryId: string,
  failureCode: MemoryAuthorityProjectionFailureCode,
  message: string,
  failedReceiptId?: string,
): BlockedMemoryAuthorityProjection {
  return {
    status: 'blocked',
    memoryId,
    failureCode,
    failedReceiptId,
    message,
  };
}
