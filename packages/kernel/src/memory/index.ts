export { MemoryManager } from './memory-manager';
export { MemoryLifecycleEngine } from './memory-lifecycle';
export { InMemoryMemoryEventLog } from './memory-event-log';
export { MemoryConsolidationEngine } from './memory-consolidation';
export { mergeMemoryProvenance } from './memory-provenance';
export {
  allowedMemoryAuthorityTransitions,
  isTerminalMemoryAuthorityState,
  validateMemoryAuthorityTransition,
} from './memory-authority-lifecycle';
export {
  InMemoryMemoryAuthorityReceiptRepository,
  MemoryAuthorityReceiptConflictError,
  verifyMemoryAuthorityReceiptIntegrity,
} from './memory-authority-receipt-repository';
export { MemoryAuthorityTransitionService } from './memory-authority-transition-service';
export { projectMemoryAuthorityState } from './memory-authority-projector';
export { reconcileMemoryAuthorityAtStartup } from './memory-authority-reconciliation';
export { gateMemoryRetrieval } from './memory-retrieval-gate';
export type { CreateMemoryInput } from './memory-manager';
export type {
  MemoryLifecycleAction,
  MemoryLifecycleEvent,
  MemoryLifecycleOptions,
} from './memory-lifecycle';
export type {
  MemoryApprovalDecision,
  MemoryAuthorityActor,
  MemoryAuthorityActorType,
  MemoryAuthorityState,
  MemoryAuthorityTransitionFailureCode,
  MemoryAuthorityTransitionRequest,
  MemoryAuthorityTransitionValidation,
} from './memory-authority-lifecycle';
export type {
  MemoryAuthorityReceiptAppendResult,
  MemoryAuthorityReceiptPayload,
  MemoryAuthorityReceiptRepository,
  MemoryAuthorityTransitionReceipt,
} from './memory-authority-receipt-repository';
export type {
  ExecuteMemoryAuthorityTransitionInput,
  ExecuteMemoryAuthorityTransitionResult,
} from './memory-authority-transition-service';
export type {
  BlockedMemoryAuthorityProjection,
  MemoryAuthorityProjection,
  MemoryAuthorityProjectionFailureCode,
  ValidMemoryAuthorityProjection,
} from './memory-authority-projector';
export type {
  MemoryAuthorityReconciliationEntry,
  MemoryAuthorityReconciliationInput,
  MemoryAuthorityReconciliationReport,
  MemoryAuthorityReconciliationStatus,
  MemoryAuthorityReferenceCatalog,
} from './memory-authority-reconciliation';
export type {
  MemoryRetrievalCandidate,
  MemoryRetrievalGateResult,
} from './memory-retrieval-gate';
export type { MemoryEventLog } from './memory-event-log';
export type { MemoryConsolidationGroup } from './memory-consolidation';
export type {
  MemoryProvenance,
  MemoryWithProvenance,
} from './memory-provenance';
export type { Memory, MemoryId, MemoryKind, MemoryRepository } from './memory-repository';
