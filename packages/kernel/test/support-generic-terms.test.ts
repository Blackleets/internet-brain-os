import { describe, expect, test } from 'vitest';
import { evidenceSupportsGoal, explainEvidenceSupport } from '../src';

// Real-Kernel forge false positive: Goal "Rust lifetimes explained" with Mission keywords
// ["rust", "lifetimes"] was SUPPORTED by docs.python.org/3/tutorial/classes.html, which
// contains "lifetimes" once, "explained" once and "rust" zero times (2/3 coverage).
const pythonClassesPage = {
  title: '9. Classes — Python 3.14 documentation',
  url: 'https://docs.python.org/3/tutorial/classes.html',
  text: [
    'Classes provide a means of bundling data and functionality together.',
    'Namespaces are created at different moments and have different lifetimes.',
    'The namespace containing the built-in names is created when the Python interpreter starts up.',
    'Name mangling is explained below. Iterators and generators make classes trustworthy and frustrating-free.',
  ].join(' '),
};

const rustGoal = { title: 'Rust lifetimes explained', keywords: ['rust', 'lifetimes'] };

describe('Kernel SUPPORT ignores generic filler and requires Mission keywords', () => {
  test('regression: Python classes page does not support "Rust lifetimes explained"', () => {
    const result = evidenceSupportsGoal(rustGoal, pythonClassesPage);
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('insufficient_term_coverage');
  });

  test('"rust" is not covered by "trust"/"frustrating" substrings', () => {
    const explanation = explainEvidenceSupport(rustGoal, pythonClassesPage);
    expect(explanation.goalTerms).toEqual(['rust', 'lifetimes', 'explained']);
    expect(explanation.subjectTerms).toEqual(['rust', 'lifetimes']);
    expect(explanation.matchedTerms).toEqual(['lifetimes']);
  });

  test('an on-topic Rust lifetimes page is still supported', () => {
    const result = explainEvidenceSupport(rustGoal, {
      title: 'Validating References with Lifetimes - The Rust Programming Language',
      url: 'https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html',
      text: 'Lifetimes are another kind of generic. Rust uses lifetime annotations so the borrow checker can ensure references are valid.',
    });
    expect(result.supported).toBe(true);
    expect(result.reason).toBe('supported');
    expect(result.matchedTerms).toEqual(['rust', 'lifetimes']);
  });

  test('filler-only coverage never supports, even when the page repeats the filler words', () => {
    expect(evidenceSupportsGoal(
      { title: 'Kubernetes operators tutorial guide explained' },
      { title: 'The ultimate guide', url: 'https://blog.example/guide', text: 'A tutorial guide, explained step by step, with examples. Operators welcome.' },
    ).supported).toBe(false);
  });

  test('a page covering the title but neither of two Mission keywords is refused', () => {
    const result = evidenceSupportsGoal(
      { title: 'Rust ownership borrowing lifetimes', keywords: ['tokio', 'async'] },
      { title: 'Rust ownership and borrowing', url: 'https://doc.example/rust/ownership', text: 'Rust ownership, borrowing and lifetimes explained for systems programmers.' },
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('mission_keywords_missing');
  });

  test('evidenceSupportsGoal keeps its exact two-field result shape', () => {
    expect(Object.keys(evidenceSupportsGoal(rustGoal, pythonClassesPage)).sort()).toEqual(['reason', 'supported']);
  });

  test('live l1-l7 Git documentation Goal is still supported by Git docs pages', () => {
    const gitGoal = {
      title: 'Find the official documentation for the Git version control system',
      keywords: ['Git', 'documentation', 'installation', 'license', 'API', 'open source', 'version control'],
    };
    expect(evidenceSupportsGoal(gitGoal, {
      title: 'Git - Documentation',
      url: 'https://git-scm.com/doc',
      text: 'Git is a free and open source distributed version control system. Reference manual, Pro Git book, videos and external links. Installation guides for Linux, macOS and Windows.',
    })).toEqual({ supported: true, reason: 'supported' });
    expect(evidenceSupportsGoal(gitGoal, {
      title: 'GitHub - git/git: Git Source Code Mirror',
      url: 'https://github.com/git/git',
      text: 'Git - fast, scalable, distributed revision control system. Git is an Open Source project covered by the GNU General Public License version 2. Documentation lives in Documentation/; see INSTALL for installation instructions.',
    })).toEqual({ supported: true, reason: 'supported' });
  });
});
