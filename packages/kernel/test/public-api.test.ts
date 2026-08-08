import { describe, expect, test } from 'vitest';
import {
  ArchivedCaseMutationError,
  CaseAlreadyExistsError,
  CaseManager,
  CaseNotFoundError,
  GoalNotFoundForPlanError,
  InvalidCaseInputError,
  InvalidCaseTransitionError,
  ProposedPlanCapabilityDeniedError,
  ProposedPlanManager,
  ProposedPlanRevisionConflictError,
  StaleCaseUpdateError,
} from '../src';
import type {
  CaseRepository,
  CreateCaseInput,
  CreateProposedPlanInput,
  UniversalGoal,
  UpdateCaseInput,
  UpdateProposedPlanInput,
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

  test('exports compile-time Case contracts', () => {
    const acceptTypes = (
      _repository: CaseRepository,
      _create: CreateCaseInput,
      _update: UpdateCaseInput,
    ): void => undefined;
    expect(acceptTypes).toBeTypeOf('function');
  });

  test('exports Proposed Plan runtime boundaries', () => {
    expect(ProposedPlanManager).toBeTypeOf('function');
    expect(GoalNotFoundForPlanError).toBeTypeOf('function');
    expect(ProposedPlanCapabilityDeniedError).toBeTypeOf('function');
    expect(ProposedPlanRevisionConflictError).toBeTypeOf('function');
  });

  test('exports compile-time Goal and Proposed Plan contracts', () => {
    const acceptPlanTypes = (
      _goal: UniversalGoal,
      _create: CreateProposedPlanInput,
      _update: UpdateProposedPlanInput,
    ): void => undefined;
    expect(acceptPlanTypes).toBeTypeOf('function');
  });
});
