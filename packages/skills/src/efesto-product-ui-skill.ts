import type { SkillDefinition, SkillId } from '@internet-brain-os/shared';

export const efestoProductUiSkillDefinition: SkillDefinition = {
  id: 'skill:efesto-product-ui' as SkillId,
  name: 'Efesto Product UI',
  description: 'Enforces goal-first UX, honest system state, responsive behavior, accessibility, and action-to-Kernel contracts for Efesto product surfaces.',
  version: '1.0.0',
  tags: ['ui', 'ux', 'accessibility', 'responsive', 'kernel-contracts'],
  inputSchemaVersion: '1.0.0',
  outputSchemaVersion: '1.0.0',
};

export const EFESTO_PRODUCT_UI_PRINCIPLES = Object.freeze([
  'goal-first',
  'truthful-state',
  'kernel-authority',
  'functional-controls-only',
  'mobile-first-responsive',
  'accessible-by-default',
  'recoverable-failures',
  'motion-mirrors-persisted-state',
] as const);

export type EfestoProductUiPrinciple = (typeof EFESTO_PRODUCT_UI_PRINCIPLES)[number];

export type EfestoUiActionContract = Readonly<{
  id: string;
  label: string;
  capability: string;
  action: string;
  successState: string;
  failureState: string;
  mutatesKernel: boolean;
  requiresExplicitConfirmation: boolean;
}>;

export class EfestoUiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EfestoUiContractError';
  }
}

export function validateEfestoUiActionContract(contract: EfestoUiActionContract): EfestoUiActionContract {
  const fields: Array<keyof Pick<EfestoUiActionContract, 'id' | 'label' | 'capability' | 'action' | 'successState' | 'failureState'>> = [
    'id',
    'label',
    'capability',
    'action',
    'successState',
    'failureState',
  ];
  for (const field of fields) {
    if (!contract[field].trim()) throw new EfestoUiContractError(`Efesto UI action contract requires ${field}`);
  }
  if (contract.mutatesKernel && !contract.requiresExplicitConfirmation && /purchase|submit|delete|external/i.test(contract.action)) {
    throw new EfestoUiContractError('Irreversible or external actions require explicit confirmation');
  }
  return Object.freeze({ ...contract });
}
