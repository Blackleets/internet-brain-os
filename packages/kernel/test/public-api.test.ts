import { describe, expect, test } from 'vitest';
import {
  ArchivedCaseMutationError,
  CaseAlreadyExistsError,
  CaseManager,
  CaseNotFoundError,
  InvalidCaseInputError,
  InvalidCaseTransitionError,
  StaleCaseUpdateError,
} from '../src';
import type {
  CaseRepository,
  CreateCaseInput,
  UpdateCaseInput,
} from '../src';

describe('kernel public API', () => {
  test('exports runtime Case Manager symbols', () => {
    expect(CaseManager).toBeTypeOf('function');
    expect(CaseAlreadyExistsError).toBeTypeOf('function');
    expect(CaseNotFoundError).toBeTypeOf('function');
    expect(InvalidCaseInputError).toBeTypeOf('function');
    expect(InvalidCaseTransitionError).toBeTypeOf('function');
    expect(ArchivedCaseMutationError).toBeTypeOf('function');
    expect(StaleCaseUpdateError).toBeTypeOf('function');
  });

  test('exports compile-time contracts', () => {
    const acceptTypes = (
      _repository: CaseRepository,
      _create: CreateCaseInput,
      _update: UpdateCaseInput,
    ): void => undefined;
    expect(acceptTypes).toBeTypeOf('function');
  });
});
