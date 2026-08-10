import { describe, expect, it } from 'vitest';
import { KernelContractError } from './parse';
import { parseProductScorecardPreferences } from './product-scorecard';
import { preferencesResponse } from '../../test/fixtures';

describe('dashboard product scorecard contract', () => {
  it('accepts the Kernel-owned local-only scorecard without recalculating metrics', () => {
    const scorecard = parseProductScorecardPreferences(preferencesResponse);
    expect(scorecard).toMatchObject({
      schemaVersion: 'efesto.product-scorecard.v1',
      sourceOfTruth: 'local_kernel',
      privacy: { mode: 'local_only', externalTelemetry: false },
      primary: {
        goalUsefulFindRate: { status: 'measured', unit: 'ratio', value: 0.5 },
        timeToFirstUsefulFind: { status: 'measured', unit: 'milliseconds', value: 300000 },
        repeatGoalUsage: { status: 'measured', value: 1, reason: null, cohortUnit: 'local_installation' },
      },
    });
  });

  it.each([
    ['remote metric authority', { sourceOfTruth: 'cloud' }],
    ['external telemetry', { privacy: { mode: 'local_only', externalTelemetry: true } }],
    ['wrong schema', { schemaVersion: 'efesto.product-scorecard.v2' }],
  ])('fails closed on %s', (_label, scorecardPatch) => {
    const base = preferencesResponse.profile.productScorecard;
    const candidate = {
      ...base,
      ...scorecardPatch,
      privacy: 'privacy' in scorecardPatch ? scorecardPatch.privacy : base.privacy,
    };
    expect(() => parseProductScorecardPreferences({ ...preferencesResponse, profile: { ...preferencesResponse.profile, productScorecard: candidate } })).toThrow(KernelContractError);
  });

  it('rejects a not-measurable metric disguised as zero', () => {
    const base = preferencesResponse.profile.productScorecard;
    const repeatGoalUsage = { status: 'not_measurable', unit: 'ratio', value: 0, reason: 'no_local_goal_activation' };
    expect(() => parseProductScorecardPreferences({
      ...preferencesResponse,
      profile: {
        ...preferencesResponse.profile,
        productScorecard: { ...base, primary: { ...base.primary, repeatGoalUsage } },
      },
    })).toThrow(KernelContractError);
  });

  it('rejects ratios outside the product metric contract', () => {
    const base = preferencesResponse.profile.productScorecard;
    const goalUsefulFindRate = { ...base.primary.goalUsefulFindRate, value: 1.1 };
    expect(() => parseProductScorecardPreferences({
      ...preferencesResponse,
      profile: {
        ...preferencesResponse.profile,
        productScorecard: { ...base, primary: { ...base.primary, goalUsefulFindRate } },
      },
    })).toThrow(KernelContractError);
  });
});
