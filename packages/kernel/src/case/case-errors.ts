import type { Case, CaseId, IsoDateTime } from '@internet-brain-os/shared';

export type InvalidCaseInputField = 'title' | 'objective';

export class CaseAlreadyExistsError extends Error {
  readonly code = 'CASE_ALREADY_EXISTS';
  constructor(readonly caseId: CaseId) {
    super(`Case with id ${caseId} already exists`);
    this.name = 'CaseAlreadyExistsError';
  }
}

export class CaseNotFoundError extends Error {
  readonly code = 'CASE_NOT_FOUND';
  constructor(readonly caseId: CaseId) {
    super(`Case with id ${caseId} not found`);
    this.name = 'CaseNotFoundError';
  }
}

export class InvalidCaseInputError extends Error {
  readonly code = 'INVALID_CASE_INPUT';
  constructor(
    readonly field: InvalidCaseInputField,
    readonly value: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'InvalidCaseInputError';
  }
}

export class InvalidCaseTransitionError extends Error {
  readonly code = 'INVALID_CASE_TRANSITION';
  constructor(
    readonly caseId: CaseId,
    readonly currentStatus: Case['status'],
    readonly nextStatus: Case['status'],
    readonly reason = 'transition not permitted',
  ) {
    super(
      `Invalid transition from ${currentStatus} to ${nextStatus} for case ${caseId}: ${reason}`,
    );
    this.name = 'InvalidCaseTransitionError';
  }
}

export class ArchivedCaseMutationError extends Error {
  readonly code = 'ARCHIVED_CASE_MUTATION';
  constructor(readonly caseId: CaseId) {
    super(`Cannot mutate archived case ${caseId}`);
    this.name = 'ArchivedCaseMutationError';
  }
}

export class StaleCaseUpdateError extends Error {
  readonly code = 'STALE_CASE_UPDATE';
  constructor(
    readonly caseId: CaseId,
    readonly provided: IsoDateTime,
    readonly stored: IsoDateTime,
  ) {
    super(`Stale update for case ${caseId}: provided ${provided}, stored ${stored}`);
    this.name = 'StaleCaseUpdateError';
  }
}
