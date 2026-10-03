import { describe, expect, it } from 'vitest';
import { displayKeywords, foldTerm, goalSubjectTerms, goalTermSegments, goalTermsPresent, isGoalStopword } from './goal-terms';

describe('goal terms (display-only mirror of the Kernel tokenization)', () => {
  it('keeps subject terms and drops stopwords and generic filler', () => {
    expect(goalSubjectTerms('Rust lifetimes explained')).toEqual(['rust', 'lifetimes']);
    expect(goalSubjectTerms('Rust ownership and borrowing guide')).toEqual(['rust', 'ownership', 'borrowing']);
    expect(goalSubjectTerms('quiero buscar empleo de rider o delivery en España', ['rider', 'Empleo'])).toEqual(['empleo', 'rider', 'delivery', 'espana']);
  });

  it('folds case and accents', () => {
    expect(foldTerm('  España ')).toBe('espana');
    expect(goalTermsPresent(['Trabajo en ESPAÑA'], ['espana'])).toEqual(['espana']);
  });

  it('matches whole tokens (a page token may extend the term) and never inside other words', () => {
    const segments = goalTermSegments('Trust Rust: lifetime rules', ['rust', 'lifetime']);
    expect(segments.filter((segment) => segment.term).map((segment) => segment.text)).toEqual(['Rust', 'lifetime']);
    expect(goalTermsPresent(['Lifetimes in Rust'], ['lifetime'])).toEqual(['lifetime']);
    expect(goalTermsPresent(['Trust the process'], ['rust'])).toEqual([]);
  });

  it('round-trips the original text through segments', () => {
    const text = '… Ownership is a set of rules that govern how a Rust program manages memory.';
    expect(goalTermSegments(text, ['rust', 'ownership']).map((segment) => segment.text).join('')).toBe(text);
    expect(goalTermSegments('', ['rust'])).toEqual([]);
    expect(goalTermSegments('plain', [])).toEqual([{ text: 'plain' }]);
  });

  it('shows mission keyword chips without stopwords, filler or typos of intent verbs', () => {
    // Real Kernel scope keywords of Lewis's rider Goal ("quiero budcar empleo de ryder o delivery en españa").
    expect(displayKeywords(['quiero', 'budcar', 'empleo', 'ryder', 'delivery', 'españa'])).toEqual(['empleo', 'ryder', 'delivery', 'españa']);
    expect(displayKeywords(['en', 'de', 'the', 'guide', 'Rust', 'rust', 'ownership'])).toEqual(['Rust', 'ownership']);
    expect(displayKeywords(['bucar', 'necesitp', 'encontar', 'mercadona'])).toEqual(['mercadona']);
    // A real subject word close to nothing on the list stays, and so do multi-word keywords with a subject.
    expect(displayKeywords(['busca empleo', 'barcelona', 'uber eats'])).toEqual(['busca empleo', 'barcelona', 'uber eats']);
  });

  it('flags the same stopwords the Kernel ignores', () => {
    expect(['quiero', 'en', 'de', 'Busca', 'explained'].every(isGoalStopword)).toBe(true);
    expect(['empleo', 'rider', 'rust'].some(isGoalStopword)).toBe(false);
  });
});
