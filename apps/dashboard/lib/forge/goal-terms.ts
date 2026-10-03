/**
 * Display-only mirror of how the Kernel reads Goal terms (packages/kernel/src/evidence/support.ts):
 * fold case and accents, whole tokens, a page token may extend the term ("lifetime" → "lifetimes"),
 * stopwords and generic filler ("explained", "guide") never count as subject terms.
 *
 * It never decides SUPPORT. The forge uses it only to put gold on the words of a Kernel Evidence
 * excerpt that are Goal subject terms, and to list those terms under a Kernel SUPPORT card. The
 * verdict itself always comes from the Kernel (`verificationResults[].supported`).
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'may', 'might', 'more', 'most', 'no', 'not', 'of', 'on', 'or', 'over',
  'should', 'so', 'some', 'than', 'that', 'the', 'then', 'this', 'to', 'too', 'very', 'was',
  'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'would',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u',
  'en', 'para', 'por', 'con', 'que', 'es', 'se', 'su', 'sus', 'lo', 'le', 'les', 'esta',
  'este', 'esto', 'estas', 'estos', 'hay', 'ser', 'son', 'como', 'sobre', 'sin', 'mas',
  'find', 'finding', 'finds', 'busca', 'buscar', 'busco', 'looking', 'search', 'searches',
  'investiga', 'investigar', 'investigation', 'goal', 'objetivo', 'objetivos', 'quiero',
  'necesito', 'need', 'needed', 'please', 'me', 'mi', 'mis', 'my', 'your', 'our',
  'locate', 'record', 'public', 'filings', 'about', 'after', 'before', 'during', 'without',
  'within', 'using', 'use', 'used', 'via', 'get', 'got', 'make', 'made', 'new',
]);

const GENERIC_TERMS = new Set([
  'explain', 'explained', 'explaining', 'explains', 'explanation', 'explainer',
  'guide', 'guides', 'tutorial', 'tutorials', 'introduction', 'intro', 'overview',
  'basics', 'beginner', 'beginners', 'learn', 'learning', 'understand', 'understanding',
  'example', 'examples', 'best', 'top', 'tips', 'complete', 'ultimate', 'simple', 'easy',
  'quick', 'why', 'deep', 'dive',
]);

const MAX_TERMS = 12;

export function foldTerm(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

function tokens(value: string): string[] {
  return foldTerm(value).match(/[a-z0-9]+/g) ?? [];
}

/** Goal subject terms (Goal title + Mission keywords), folded, de-duplicated, in reading order. */
export function goalSubjectTerms(title: string, keywords: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens([title, ...keywords].join(' '))) {
    if (token.length < 2 || STOPWORDS.has(token) || GENERIC_TERMS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

function termFor(token: string, terms: readonly string[]): string | undefined {
  const folded = foldTerm(token);
  return terms.find((term) => folded === term || folded.startsWith(term));
}

export type TermSegment = { text: string; term?: string };

/** Split text into plain and Goal-term segments (whole tokens only; "rust" never lights "trust"). */
export function goalTermSegments(text: string, terms: readonly string[]): TermSegment[] {
  if (!text || !terms.length) return text ? [{ text }] : [];
  const out: TermSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const index = match.index ?? 0;
    const term = termFor(match[0], terms);
    if (!term) continue;
    if (index > last) out.push({ text: text.slice(last, index) });
    out.push({ text: match[0], term });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Goal subject terms present in the given texts, in Goal order. */
export function goalTermsPresent(texts: readonly (string | undefined)[], terms: readonly string[]): string[] {
  const present = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const segment of goalTermSegments(text, terms)) if (segment.term) present.add(segment.term);
  }
  return terms.filter((term) => present.has(term));
}
