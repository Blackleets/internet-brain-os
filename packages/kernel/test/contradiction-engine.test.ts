import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  ContradictionEngine,
  InvalidContradictionInputError,
} from '../src';
import type {
  ContradictionEvaluationInput,
  ExistingClaimSnapshot,
  ValidatedClaimCandidate,
} from '../src';

const now = '2026-07-19T21:00:00.000Z' as IsoDateTime;

function candidate(): ValidatedClaimCandidate {
  return {
    id: 'candidate-1',
    proposalId: 'proposal-1' as ValidatedClaimCandidate['proposalId'],
    statement: 'Supplier A lists a unit price of 2.10 EUR.',
    confidence: 0.9,
    evidenceIds: ['evidence-1' as EvidenceId],
    contradictsClaimIds: [],
    status: 'candidate',
    createdAt: now,
  };
}

function existing(overrides: Partial<ExistingClaimSnapshot> = {}): ExistingClaimSnapshot {
  return {
    id: 'claim-1',
    statement: 'Supplier A lists a unit price of 2.60 EUR.',
    confidence: 0.88,
    verificationStatus: 'verified',
    updatedAt: now,
    ...overrides,
  };
}

function input(
  overrides: Partial<ContradictionEvaluationInput> = {},
): ContradictionEvaluationInput {
  return {
    candidate: candidate(),
    existingClaims: [existing()],
    comparisons: [],
    evaluatedAt: now,
    ...overrides,
  };
}

describe('ContradictionEngine', () => {
  test('admits candidates when no conflict is detected', () => {
    const result = new ContradictionEngine().evaluate(input());

    expect(result.action).toBe('admit');
    expect(result.reasons).toEqual([
      { code: 'no_conflict', message: 'No material contradiction detected.' },
    ]);
    expect(result.contradictsClaimIds).toEqual([]);
  });

  test('routes possible conflicts to review', () => {
    const result = new ContradictionEngine().evaluate(
      input({
        comparisons: [
          {
            existingClaimId: 'claim-1',
            kind: 'possible',
            confidence: 0.6,
            rationale: 'Values may refer to different periods.',
          },
        ],
      }),
    );

    expect(result.action).toBe('review');
    expect(result.contradictsClaimIds).toEqual(['claim-1']);
    expect(result.reasons[0]?.code).toBe('possible_conflict');
  });

  test('blocks material conflicts with verified claims', () => {
    const result = new ContradictionEngine().evaluate(
      input({
        comparisons: [
          {
            existingClaimId: 'claim-1',
            kind: 'material',
            confidence: 0.92,
            rationale: 'Same supplier, product, currency, and effective date.',
          },
        ],
      }),
    );

    expect(result.action).toBe('block');
    expect(result.reasons[0]?.code).toBe('verified_material_conflict');
  });

  test('routes material conflicts with unverified claims to review', () => {
    const result = new ContradictionEngine().evaluate(
      input({
        existingClaims: [existing({ verificationStatus: 'unverified' })],
        comparisons: [
          { existingClaimId: 'claim-1', kind: 'material', confidence: 0.9 },
        ],
      }),
    );

    expect(result.action).toBe('review');
    expect(result.reasons[0]?.code).toBe('material_conflict');
  });

  test('rejects unknown and duplicate comparison targets', () => {
    const engine = new ContradictionEngine();

    expect(() =>
      engine.evaluate(
        input({
          comparisons: [
            { existingClaimId: 'missing', kind: 'possible', confidence: 0.5 },
          ],
        }),
      ),
    ).toThrow(InvalidContradictionInputError);

    expect(() =>
      engine.evaluate(
        input({
          comparisons: [
            { existingClaimId: 'claim-1', kind: 'possible', confidence: 0.5 },
            { existingClaimId: 'claim-1', kind: 'material', confidence: 0.8 },
          ],
        }),
      ),
    ).toThrow(InvalidContradictionInputError);
  });

  test('validates policy thresholds and isolates mutable arrays', () => {
    expect(() =>
      new ContradictionEngine({ possibleThreshold: 0.9, materialThreshold: 0.8 }),
    ).toThrow(InvalidContradictionInputError);

    const evidenceIds = candidate().evidenceIds.slice() as EvidenceId[];
    const mutableCandidate = { ...candidate(), evidenceIds };
    const result = new ContradictionEngine().evaluate(input({ candidate: mutableCandidate }));
    evidenceIds.push('later' as EvidenceId);

    expect(result.candidate.evidenceIds).toEqual(['evidence-1']);
  });
});
