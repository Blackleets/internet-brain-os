import type { IsoDateTime } from '@internet-brain-os/shared';
import type { HermesAgentRunOutput } from './hermes-agent-output-adapter';
import { InvalidHermesAgentOutputError } from './hermes-agent-output-adapter';

export type HermesNativeLogEntry =
  | { readonly type: 'run_started'; readonly runId: string; readonly missionId: string; readonly taskId: string; readonly at: IsoDateTime }
  | { readonly type: 'evidence'; readonly id: string; readonly requirementKey: string; readonly verified: boolean; readonly at: IsoDateTime }
  | { readonly type: 'claim'; readonly id: string; readonly statement: string; readonly confidence: number; readonly evidenceIds: readonly string[]; readonly at: IsoDateTime }
  | { readonly type: 'run_completed'; readonly summary: string; readonly at: IsoDateTime };

export class InvalidHermesNativeLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHermesNativeLogError';
  }
}

const FORBIDDEN_KERNEL_AUTHORITY_FIELDS = [
  'candidate',
  'validation',
  'contradiction',
  'admission',
  'claimValidation',
  'durableClaim',
  'knowledgeAdmission',
] as const;

/**
 * Extracts the bounded HermesAgentRunOutput shape from a native Hermes JSONL log.
 *
 * This is intentionally a thin translation layer. It does not infer missing
 * claims, fabricate evidence, validate knowledge, or admit memory. Its only job
 * is to normalize explicit native operational events into the bounded export
 * shape consumed by HermesAgentOutputAdapter.
 */
export class HermesNativeLogExtractor {
  fromJsonl(input: string): HermesAgentRunOutput {
    const entries = input
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => parseLine(line, index + 1));

    return this.fromEntries(entries);
  }

  fromEntries(entries: readonly unknown[]): HermesAgentRunOutput {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new InvalidHermesNativeLogError('Hermes native log is empty.');
    }

    for (const [index, entry] of entries.entries()) {
      assertNoAuthorityFields(entry, `entry[${index}]`);
    }

    const started = entries.filter((entry): entry is Extract<HermesNativeLogEntry, { type: 'run_started' }> => isEntryType(entry, 'run_started'));
    const completed = entries.filter((entry): entry is Extract<HermesNativeLogEntry, { type: 'run_completed' }> => isEntryType(entry, 'run_completed'));
    const claims = entries.filter((entry): entry is Extract<HermesNativeLogEntry, { type: 'claim' }> => isEntryType(entry, 'claim'));
    const evidence = entries.filter((entry): entry is Extract<HermesNativeLogEntry, { type: 'evidence' }> => isEntryType(entry, 'evidence'));

    if (started.length !== 1) throw new InvalidHermesNativeLogError('Exactly one native run_started entry is required.');
    if (completed.length !== 1) throw new InvalidHermesNativeLogError('Exactly one native run_completed entry is required.');
    if (claims.length !== 1) throw new InvalidHermesNativeLogError('Exactly one native claim entry is required.');
    if (evidence.length === 0) throw new InvalidHermesNativeLogError('At least one native evidence entry is required.');

    const start = started[0]!;
    const end = completed[0]!;
    const claim = claims[0]!;

    assertNativeStart(start);
    assertNativeCompletion(end);
    assertNativeClaim(claim);

    const evidenceIds = new Set<string>();
    for (const item of evidence) {
      assertNativeEvidence(item);
      if (evidenceIds.has(item.id)) throw new InvalidHermesNativeLogError(`Duplicate native evidence id: ${item.id}`);
      evidenceIds.add(item.id);
    }

    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new InvalidHermesNativeLogError(`Native claim references unknown evidence: ${evidenceId}`);
      }
    }

    if (new Date(end.at).getTime() < new Date(start.at).getTime()) {
      throw new InvalidHermesNativeLogError('Native run_completed precedes run_started.');
    }

    return {
      runId: start.runId,
      missionId: start.missionId,
      taskId: start.taskId,
      startedAt: start.at,
      completedAt: end.at,
      summary: end.summary,
      evidence: evidence.map((item) => ({
        id: item.id,
        requirementKey: item.requirementKey,
        verified: item.verified,
        recordedAt: item.at,
      })),
      claim: {
        id: claim.id,
        statement: claim.statement,
        confidence: claim.confidence,
        evidenceIds: [...claim.evidenceIds],
        proposedAt: claim.at,
      },
    };
  }
}

function parseLine(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line);
  } catch {
    throw new InvalidHermesNativeLogError(`Invalid JSONL at line ${lineNumber}.`);
  }
}

function isEntryType(value: unknown, type: HermesNativeLogEntry['type']): boolean {
  return !!value && typeof value === 'object' && (value as { type?: unknown }).type === type;
}

function assertNoAuthorityFields(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_KERNEL_AUTHORITY_FIELDS as readonly string[]).includes(key)) {
      throw new InvalidHermesAgentOutputError(`Hermes native log cannot include Kernel authority field: ${path}.${key}`);
    }
    if (item && typeof item === 'object') assertNoAuthorityFields(item, `${path}.${key}`);
  }
}

function assertNativeStart(entry: Extract<HermesNativeLogEntry, { type: 'run_started' }>): void {
  assertNonEmpty(entry.runId, 'run_started.runId');
  assertNonEmpty(entry.missionId, 'run_started.missionId');
  assertNonEmpty(entry.taskId, 'run_started.taskId');
  assertIso(entry.at, 'run_started.at');
}

function assertNativeCompletion(entry: Extract<HermesNativeLogEntry, { type: 'run_completed' }>): void {
  assertNonEmpty(entry.summary, 'run_completed.summary');
  assertIso(entry.at, 'run_completed.at');
}

function assertNativeEvidence(entry: Extract<HermesNativeLogEntry, { type: 'evidence' }>): void {
  assertNonEmpty(entry.id, 'evidence.id');
  assertNonEmpty(entry.requirementKey, 'evidence.requirementKey');
  if (typeof entry.verified !== 'boolean') throw new InvalidHermesNativeLogError('evidence.verified must be boolean.');
  assertIso(entry.at, 'evidence.at');
}

function assertNativeClaim(entry: Extract<HermesNativeLogEntry, { type: 'claim' }>): void {
  assertNonEmpty(entry.id, 'claim.id');
  assertNonEmpty(entry.statement, 'claim.statement');
  if (!Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1) {
    throw new InvalidHermesNativeLogError('claim.confidence must be between 0 and 1.');
  }
  if (!Array.isArray(entry.evidenceIds) || entry.evidenceIds.length === 0) {
    throw new InvalidHermesNativeLogError('claim.evidenceIds must not be empty.');
  }
  assertIso(entry.at, 'claim.at');
}

function assertNonEmpty(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidHermesNativeLogError(`${field} is required.`);
  }
}

function assertIso(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0 || !Number.isFinite(new Date(value).getTime())) {
    throw new InvalidHermesNativeLogError(`${field} must be a valid ISO timestamp.`);
  }
}
