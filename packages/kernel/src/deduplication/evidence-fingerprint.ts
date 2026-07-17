import type { Evidence } from '@internet-brain-os/shared';

export interface EvidenceFingerprint {
  readonly fingerprint: string;
  readonly normalizedSource: string;
  readonly contentHash: string;
}

/** Deterministic, dependency-free fingerprinting for evidence deduplication. */
export function fingerprintEvidence(evidence: Pick<Evidence, 'sourceUrl' | 'rawText' | 'contentType'>): EvidenceFingerprint {
  const normalizedSource = normalizeSource(evidence.sourceUrl ?? '');
  const normalizedContent = normalizeText(evidence.rawText ?? '');
  const contentHash = hash(`${evidence.contentType}|${normalizedContent}`);
  return { fingerprint: hash(`${normalizedSource}|${contentHash}`), normalizedSource, contentHash };
}

function normalizeSource(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizeText(value: string): string { return value.replace(/\s+/g, ' ').trim().toLowerCase(); }

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}
