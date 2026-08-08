import { describe, expect, test } from 'vitest';
import {
  ArchivedCaseMutationError,
  CapabilityDeniedError,
  CapabilityGatedProposedPlanService,
  CapabilityNotFoundError,
  CapabilityRegistry,
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
  CapabilityDefinition,
  CapabilityRequest,
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

  test('exports Capability Registry runtime boundaries', () => {
    expect(CapabilityRegistry).toBeTypeOf('function');
    expect(CapabilityGatedProposedPlanService).toBeTypeOf('function');
    expect(CapabilityNotFoundError).toBeTypeOf('function');
    expect(CapabilityDeniedError).toBeTypeOf('function');
  });

  test('exports compile-time Goal, Plan and Capability contracts', () => {
    const acceptPlanTypes = (
      _goal: UniversalGoal,
      _create: CreateProposedPlanInput,
      _update: UpdateProposedPlanInput,
      _capability: CapabilityDefinition,
      _request: CapabilityRequest,
    ): void => undefined;
    expect(acceptPlanTypes).toBeTypeOf('function');
  });
});
