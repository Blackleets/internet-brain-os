import { describe, expect, it } from 'vitest';
import { foldTerm, goalSubjectTerms, goalTermSegments, goalTermsPresent } from './goal-terms';

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
});
