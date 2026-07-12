import { describe, expect, test } from 'vitest';
import {
  ArchivedCaseEvidenceLinkError,
  EvidenceAlreadyExistsError,
  EvidenceManager,
  EvidenceNotFoundError,
  InvalidEvidenceInputError,
  StaleEvidenceUpdateError,
} from '../src';
import type {
  CreateEvidenceInput,
  EvidenceCaseReader,
  EvidenceRecord,
  EvidenceRepository,
  UpdateEvidenceMetadataInput,
} from '../src';

describe('Evidence Manager public API', () => {
  test('exports runtime symbols', () => {
    expect(EvidenceManager).toBeTypeOf('function');
    expect(EvidenceAlreadyExistsError).toBeTypeOf('function');
    expect(EvidenceNotFoundError).toBeTypeOf('function');
    expect(InvalidEvidenceInputError).toBeTypeOf('function');
    expect(StaleEvidenceUpdateError).toBeTypeOf('function');
    expect(ArchivedCaseEvidenceLinkError).toBeTypeOf('function');
  });

  test('exports compile-time contracts', () => {
    const acceptsContracts = (
      _repository: EvidenceRepository,
      _caseReader: EvidenceCaseReader,
      _record: EvidenceRecord,
      _create: CreateEvidenceInput,
      _update: UpdateEvidenceMetadataInput,
    ): void => undefined;
    expect(acceptsContracts).toBeTypeOf('function');
  });
});
