import { describe, expect, it } from 'vitest';
import {
  EFESTO_PRODUCT_UI_PRINCIPLES,
  EfestoUiContractError,
  efestoProductUiSkillDefinition,
  validateEfestoUiActionContract,
} from '../src/efesto-product-ui-skill';

describe('Efesto Product UI skill', () => {
  it('publishes the product UI design contract', () => {
    expect(efestoProductUiSkillDefinition.id).toBe('skill:efesto-product-ui');
    expect(EFESTO_PRODUCT_UI_PRINCIPLES).toContain('functional-controls-only');
    expect(EFESTO_PRODUCT_UI_PRINCIPLES).toContain('motion-mirrors-persisted-state');
  });

  it('accepts a complete reversible action contract', () => {
    const contract = validateEfestoUiActionContract({
      id: 'goal.prepare',
      label: 'Preparar Goal',
      capability: 'goal.create',
      action: 'Prepare a local Goal draft',
      successState: 'Goal draft visible for confirmation',
      failureState: 'Draft remains unchanged and error is visible',
      mutatesKernel: false,
      requiresExplicitConfirmation: false,
    });
    expect(contract.id).toBe('goal.prepare');
  });

  it('rejects incomplete and unsafe irreversible contracts', () => {
    expect(() => validateEfestoUiActionContract({
      id: '', label: 'Broken', capability: 'none', action: 'noop', successState: 'none', failureState: 'visible',
      mutatesKernel: false, requiresExplicitConfirmation: false,
    })).toThrow(EfestoUiContractError);

    expect(() => validateEfestoUiActionContract({
      id: 'external.submit', label: 'Submit', capability: 'external.write', action: 'submit external form',
      successState: 'submitted', failureState: 'blocked', mutatesKernel: true, requiresExplicitConfirmation: false,
    })).toThrow('explicit confirmation');
  });
});
