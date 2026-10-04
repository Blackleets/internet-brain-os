import { describe, expect, it } from 'vitest';
import { findCategoryEs, findNextActionEs, shortKernelId } from './find-copy';

describe('Finds display copy', () => {
  it('shows the Kernel classifier strings in Spanish and leaves unknown text exactly as stored', () => {
    expect(findNextActionEs('Review fit and application requirements')).toBe('Revisa si encaja y los requisitos para postularte');
    expect(findNextActionEs('Open the source and confirm it answers your Goal')).toBe('Abre la fuente y confirma que responde a tu Goal');
    expect(findNextActionEs('Llama antes del viernes')).toBe('Llama antes del viernes');
    expect(findCategoryEs('Job')).toBe('Empleo');
    expect(findCategoryEs('Goal match')).toBe('Coincide con el Goal');
    expect(findCategoryEs('Otra cosa')).toBe('Otra cosa');
  });

  it('shortens Kernel ids to kind + first 8 hex chars, keeping the full id', () => {
    const hex = 'b08de4bb68ab6276c752e96faf6a662a176810c200c1cdaede230e1803f2f36c';
    expect(shortKernelId(`case:verified:${hex}`)).toEqual({ kind: 'case', short: 'b08de4bb', full: `case:verified:${hex}` });
    expect(shortKernelId(`mission:${hex}`)).toEqual({ kind: 'mission', short: 'b08de4bb', full: `mission:${hex}` });
    expect(shortKernelId('evidence-forge-a')).toEqual({ kind: '', short: 'evidence-for…', full: 'evidence-forge-a' });
    expect(shortKernelId('case-1')).toEqual({ kind: '', short: 'case-1', full: 'case-1' });
  });
});
