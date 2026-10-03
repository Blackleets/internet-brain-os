import { KernelClient } from './client';

/**
 * Client for the read-only Kernel route GET /api/agent-missions/:id/evidence.
 * The Kernel returns only Evidence it persisted for the Mission (web.read), the Kernel's own
 * SUPPORT decision and one bounded verbatim excerpt. Anything malformed is rejected so the
 * Forge never renders a quote that did not come from a Kernel Evidence record.
 */
export const MISSION_EVIDENCE_SCHEMA_VERSION = 'efesto.mission-evidence.v1' as const;
const MAX_RECORDS = 20;
const MAX_EXCERPT_CHARS = 280;

export type MissionEvidenceExcerpt = {
  text: string;
  anchor: 'goal_term' | 'start';
  truncatedStart: boolean;
  truncatedEnd: boolean;
};

export type MissionEvidenceRecord = {
  id: string;
  candidateId: string;
  caseId?: string;
  sourceUrl: string;
  title: string;
  capturedAt: string;
  supported: boolean;
  supportReason?: string;
  excerpt: MissionEvidenceExcerpt | null;
};

export type MissionEvidence = {
  missionId: string;
  evidence: MissionEvidenceRecord[];
};

export class MissionEvidenceContractError extends Error {
  readonly name = 'MissionEvidenceContractError';
  constructor(readonly path: string) {
    super(`Invalid mission Evidence contract at ${path}`);
  }
}

export function loadMissionEvidence(client: KernelClient, missionId: string, signal?: AbortSignal): Promise<MissionEvidence> {
  const id = missionId.trim();
  if (!id || id.length > 200) throw new MissionEvidenceContractError('missionId');
  return client.get(`/api/agent-missions/${encodeURIComponent(id)}/evidence`, (value) => parseMissionEvidence(value, id), signal);
}

export function parseMissionEvidence(value: unknown, expectedMissionId?: string): MissionEvidence {
  const body = record(value, 'missionEvidence');
  if (body.ok !== true) throw new MissionEvidenceContractError('missionEvidence.ok');
  if (body.schemaVersion !== MISSION_EVIDENCE_SCHEMA_VERSION) throw new MissionEvidenceContractError('missionEvidence.schemaVersion');
  if (body.sourceOfTruth !== 'kernel') throw new MissionEvidenceContractError('missionEvidence.sourceOfTruth');
  const missionId = text(body.missionId, 'missionEvidence.missionId', 200);
  if (expectedMissionId !== undefined && missionId !== expectedMissionId) throw new MissionEvidenceContractError('missionEvidence.missionId');
  if (!Array.isArray(body.evidence) || body.evidence.length > MAX_RECORDS) throw new MissionEvidenceContractError('missionEvidence.evidence');
  return {
    missionId,
    evidence: body.evidence.map((item, index) => parseRecord(item, `missionEvidence.evidence[${index}]`)),
  };
}

function parseRecord(value: unknown, path: string): MissionEvidenceRecord {
  const item = record(value, path);
  if (typeof item.supported !== 'boolean') throw new MissionEvidenceContractError(`${path}.supported`);
  const sourceUrl = text(item.sourceUrl, `${path}.sourceUrl`, 2048);
  if (!isHttpUrl(sourceUrl)) throw new MissionEvidenceContractError(`${path}.sourceUrl`);
  return {
    id: text(item.id, `${path}.id`, 240),
    candidateId: typeof item.candidateId === 'string' ? item.candidateId.slice(0, 200) : '',
    ...(typeof item.caseId === 'string' && item.caseId ? { caseId: item.caseId.slice(0, 240) } : {}),
    sourceUrl,
    title: typeof item.title === 'string' ? item.title.slice(0, 240) : '',
    capturedAt: typeof item.capturedAt === 'string' ? item.capturedAt.slice(0, 40) : '',
    supported: item.supported,
    ...(typeof item.supportReason === 'string' && item.supportReason ? { supportReason: item.supportReason.slice(0, 80) } : {}),
    excerpt: parseExcerpt(item.excerpt, `${path}.excerpt`),
  };
}

function parseExcerpt(value: unknown, path: string): MissionEvidenceExcerpt | null {
  if (value === null || value === undefined) return null;
  const item = record(value, path);
  const excerptText = text(item.text, `${path}.text`, MAX_EXCERPT_CHARS);
  if (item.anchor !== 'goal_term' && item.anchor !== 'start') throw new MissionEvidenceContractError(`${path}.anchor`);
  return {
    text: excerptText,
    anchor: item.anchor,
    truncatedStart: item.truncatedStart === true,
    truncatedEnd: item.truncatedEnd === true,
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MissionEvidenceContractError(path);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string') throw new MissionEvidenceContractError(path);
  const result = value.trim();
  if (!result || result.length > max) throw new MissionEvidenceContractError(path);
  return result;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
