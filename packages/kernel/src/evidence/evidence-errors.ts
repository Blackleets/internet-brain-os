import type {
  CaseId,
  EvidenceId,
  IsoDateTime,
} from '@internet-brain-os/shared';

export type InvalidEvidenceInputField =
  | 'sourceUrl'
  | 'contentHash'
  | 'confidence'
  | 'summary'
  | 'tags';

export class EvidenceAlreadyExistsError extends Error {
  readonly code = 'EVIDENCE_ALREADY_EXISTS';
  constructor(readonly evidenceId: EvidenceId) {
    super(`Evidence with id ${evidenceId} already exists`);
    this.name = 'EvidenceAlreadyExistsError';
  }
}

export class EvidenceNotFoundError extends Error {
  readonly code = 'EVIDENCE_NOT_FOUND';
  constructor(readonly evidenceId: EvidenceId) {
    super(`Evidence with id ${evidenceId} not found`);
    this.name = 'EvidenceNotFoundError';
  }
}

export class InvalidEvidenceInputError extends Error {
  readonly code = 'INVALID_EVIDENCE_INPUT';
  constructor(
    readonly field: InvalidEvidenceInputField,
    readonly value: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'InvalidEvidenceInputError';
  }
}

export class ImmutableEvidenceFieldError extends Error {
  readonly code = 'IMMUTABLE_EVIDENCE_FIELD';
  constructor(
    readonly evidenceId: EvidenceId,
    readonly field: string,
  ) {
    super(`Evidence field ${field} is immutable for ${evidenceId}`);
    this.name = 'ImmutableEvidenceFieldError';
  }
}

export class StaleEvidenceUpdateError extends Error {
  readonly code = 'STALE_EVIDENCE_UPDATE';
  constructor(
    readonly evidenceId: EvidenceId,
    readonly provided: IsoDateTime,
    readonly stored: IsoDateTime,
  ) {
    super(`Stale update for evidence ${evidenceId}: provided ${provided}, stored ${stored}`);
    this.name = 'StaleEvidenceUpdateError';
  }
}

export class ArchivedCaseEvidenceLinkError extends Error {
  readonly code = 'ARCHIVED_CASE_EVIDENCE_LINK';
  constructor(
    readonly evidenceId: EvidenceId,
    readonly caseId: CaseId,
  ) {
    super(`Cannot link evidence ${evidenceId} to archived case ${caseId}`);
    this.name = 'ArchivedCaseEvidenceLinkError';
  }
}
