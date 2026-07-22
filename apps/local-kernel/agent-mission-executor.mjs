import { createHash, randomUUID } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';
import { classifyOpportunity } from './opportunity-classifier.mjs';

const MAX_FINDINGS = 20;
const MAX_ATTEMPTS = 3;
const DEFAULT_LEASE_MS = 30 * 60_000;

export class AgentMissionExecutor {
  constructor(store, opportunityProjector, options = {}) {
    this.store = store;
    this.opportunityProjector = opportunityProjector;
    this.now = options.now ?? (() => new Date());
    this.leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  }

  async claim(agent = 'hermes') {
    const claimedAt = this.now();
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.agent === agent && isClaimable(item, claimedAt));
      if (index < 0) return { changed: false, data, result: undefined };
      const current = missions[index];
      const attempt = Number(current.attempt ?? 0) + 1;
      if (attempt > MAX_ATTEMPTS) return { changed: false, data, result: undefined };
      const leaseId = randomUUID();
      const mission = {
        ...current,
        status: 'running',
        executionPhase: 'investigating',
        attempt,
        claimedAt: claimedAt.toISOString(),
        investigatingAt: claimedAt.toISOString(),
        leaseExpiresAt: new Date(claimedAt.getTime() + this.leaseMs).toISOString(),
        leaseId,
        limitation: 'Public-source discovery only; return bounded findings for Kernel validation',
      };
      const updated = [...missions];
      updated[index] = mission;
      return {
        changed: true,
        data: { ...data, agentMissions: updated },
        result: publicClaim(mission),
      };
    });
  }

  async complete(missionId, input) {
    const leaseId = clean(input?.leaseId, 80, 'leaseId');
    if (!Array.isArray(input?.findings) || input.findings.length > MAX_FINDINGS) {
      throw invalid(`findings must be an array with at most ${MAX_FINDINGS} items`);
    }
    const findings = input.findings.map(validateFinding);
    const mission = await this.#requireLease(missionId, leaseId);
    const verifyingAt = this.now().toISOString();
    await this.#markVerifying(missionId, leaseId, verifyingAt);
    const accepted = [];
    for (const finding of findings) accepted.push(await this.#ingest(mission, finding));
    const promoted = accepted.filter((item) => item.opportunity?.status === 'opportunity').length;
    const completedAt = this.now().toISOString();
    const result = await this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      if (current?.status === 'completed') return { changed: false, data, result: current };
      requireActiveLease(current, leaseId, this.now());
      const completed = {
        ...current, status: 'completed', executionPhase: 'forged', completedAt, forgedAt: completedAt,
        resultSummary: {
          received: findings.length,
          evidenceCreated: accepted.filter((item) => !item.duplicate).length,
          opportunitiesPromoted: promoted,
        },
      };
      delete completed.leaseId;
      delete completed.leaseExpiresAt;
      const updated = [...missions];
      updated[index] = completed;
      return { changed: true, data: { ...data, agentMissions: updated }, result: completed };
    });
    return { mission: result, findings: accepted };
  }

  async fail(missionId, input) {
    const leaseId = clean(input?.leaseId, 80, 'leaseId');
    const reason = clean(input?.reason, 500, 'reason');
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      requireActiveLease(current, leaseId, this.now());
      const exhausted = Number(current.attempt ?? 0) >= MAX_ATTEMPTS;
      const next = {
        ...current, status: exhausted ? 'failed' : 'queued',
        executionPhase: exhausted ? 'failed' : 'queued',
        lastFailure: { reason, recordedAt: this.now().toISOString(), attempt: current.attempt },
        limitation: exhausted ? 'Bounded external-agent attempts exhausted' : 'Retry queued after observable agent failure',
      };
      delete next.leaseId;
      delete next.leaseExpiresAt;
      const updated = [...missions];
      updated[index] = next;
      return { changed: true, data: { ...data, agentMissions: updated }, result: next };
    });
  }

  async #requireLease(missionId, leaseId) {
    const data = await this.store.read();
    const mission = (data.agentMissions ?? []).find((item) => item.id === missionId);
    requireActiveLease(mission, leaseId, this.now());
    return mission;
  }

  async #markVerifying(missionId, leaseId, verifyingAt) {
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      requireActiveLease(current, leaseId, this.now());
      const verifying = { ...current, executionPhase: 'verifying', verifyingAt };
      const updated = [...missions];
      updated[index] = verifying;
      return { changed: true, data: { ...data, agentMissions: updated }, result: verifying };
    });
  }

  async #ingest(mission, finding) {
    const suffix = createHash('sha256').update(`${mission.id}\n${finding.url}`).digest('hex');
    const caseId = `case:agent:${suffix}`;
    const evidenceId = `evidence:agent:${suffix}`;
    const capturedAt = finding.discoveredAt ?? this.now().toISOString();
    const context = {
      schemaVersion: 'hephaestus.page-context.v1', url: finding.url, title: finding.title,
      visibleText: finding.text, description: finding.summary, capturedAt,
    };
    const evidence = await this.store.project(async (data) => {
      const existing = (data.evidence ?? []).find((item) => item.id === evidenceId);
      if (existing) return { changed: false, data, result: { caseId: existing.caseId, evidenceId, duplicate: true } };
      const caseRecord = {
        id: caseId, title: finding.title,
        objective: `Verify a public finding returned for Goal: ${mission.goalTitle}`,
        description: finding.summary, status: 'draft', tags: ['agent-research', mission.agent],
        createdAt: capturedAt, updatedAt: capturedAt,
      };
      const evidenceRecord = {
        id: evidenceId, caseId, sourceReceiptId: `agent-result:${suffix}`, sourceUrl: finding.url,
        contentType: 'webpage', mimeType: 'text/plain',
        contentHash: createHash('sha256').update(finding.text).digest('hex'), rawText: finding.text,
        summary: finding.summary ?? finding.title, capturedAt,
        extractionMethod: `${mission.agent}-public-research-v1`, confidence: 0.4,
        tags: ['agent-research', 'unverified'], entityIds: [], relationshipIds: [], missionId: mission.id,
      };
      return {
        changed: true,
        data: { ...data, cases: [...(data.cases ?? []), caseRecord], evidence: [...(data.evidence ?? []), evidenceRecord] },
        result: { caseId, evidenceId, duplicate: false },
      };
    });
    const classified = classifyOpportunity(context, evidence);
    if (classified.status === 'opportunity' && mission.scope.categories?.length && !mission.scope.categories.includes(classified.opportunity.category)) {
      return { ...evidence, status: 'out_of_scope', sourceUrl: finding.url };
    }
    const opportunity = await this.opportunityProjector.project(context, evidence);
    return { ...evidence, sourceUrl: finding.url, opportunity };
  }
}

function isClaimable(mission, now) {
  if (mission.status === 'queued') return true;
  return mission.status === 'running' && Date.parse(mission.leaseExpiresAt) <= now.getTime() && Number(mission.attempt ?? 0) < MAX_ATTEMPTS;
}

function publicClaim(mission) {
  return {
    id: mission.id, goalId: mission.goalId, goalTitle: mission.goalTitle, agent: mission.agent,
    scope: mission.scope, cadence: mission.cadence, attempt: mission.attempt,
    leaseId: mission.leaseId, leaseExpiresAt: mission.leaseExpiresAt,
  };
}

function requireActiveLease(mission, leaseId, now) {
  if (!mission) throw new InboxError('AGENT_MISSION_NOT_FOUND', 'Agent mission was not found', 404);
  if (mission.status === 'completed') throw new InboxError('AGENT_MISSION_COMPLETED', 'Agent mission is already completed', 409);
  if (mission.status !== 'running' || mission.leaseId !== leaseId || Date.parse(mission.leaseExpiresAt) <= now.getTime()) {
    throw new InboxError('AGENT_MISSION_LEASE_INVALID', 'Agent mission lease is invalid or expired', 409);
  }
}

function validateFinding(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`finding ${index} must be an object`);
  const url = clean(value.url, 2048, 'url');
  let parsed;
  try { parsed = new URL(url); } catch { throw invalid(`finding ${index} URL is invalid`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid(`finding ${index} URL must be public HTTP(S)`);
  if (isPrivateHost(parsed.hostname) || [...parsed.searchParams.keys()].some((key) => /^(?:token|access_token|auth|authorization|api[_-]?key|code|session|signature|sig)$/i.test(key))) {
    throw invalid(`finding ${index} URL contains private or sensitive data`);
  }
  return {
    url: parsed.href, title: clean(value.title, 240, 'title'), text: clean(value.text, 20_000, 'text'),
    summary: optional(value.summary, 500, 'summary'), discoveredAt: optionalDate(value.discoveredAt),
  };
}

function clean(value, max, field) {
  if (typeof value !== 'string') throw invalid(`${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw invalid(`${field} is invalid`);
  return result;
}
function optional(value, max, field) { return value === undefined ? undefined : clean(value, max, field); }
function optionalDate(value) {
  if (value === undefined) return undefined;
  const result = clean(value, 40, 'discoveredAt');
  if (!Number.isFinite(Date.parse(result))) throw invalid('discoveredAt must be an ISO timestamp');
  return new Date(result).toISOString();
}
function invalid(message) { return new InboxError('INVALID_AGENT_RESULT', message, 400); }

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  const ipv6 = parseIpv6(host);
  if (ipv6) {
    if (ipv6.every((value) => value === 0)) return true;
    if (ipv6.slice(0, 15).every((value) => value === 0) && ipv6[15] === 1) return true;
    if ((ipv6[0] & 0xfe) === 0xfc) return true;
    if (ipv6[0] === 0xfe && (ipv6[1] & 0xc0) === 0x80) return true;
    if (ipv6.slice(0, 10).every((value) => value === 0) && ipv6[10] === 0xff && ipv6[11] === 0xff) {
      return isPrivateIpv4(ipv6.slice(12));
    }
    return false;
  }
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  return isPrivateIpv4(octets);
}

function isPrivateIpv4(octets) {
  return octets.some((value) => value > 255) || octets[0] === 10 || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168) || octets[0] === 0;
}

function parseIpv6(host) {
  if (!host.includes(':')) return undefined;
  const halves = host.split('::');
  if (halves.length > 2) return undefined;
  const left = parseIpv6Half(halves[0]);
  const right = parseIpv6Half(halves[1] ?? '');
  if (!left || !right) return undefined;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const words = [...left, ...Array(missing).fill(0), ...right];
  if (words.length !== 8) return undefined;
  return words.flatMap((word) => [word >> 8, word & 0xff]);
}

function parseIpv6Half(value) {
  if (!value) return [];
  const words = [];
  for (const part of value.split(':')) {
    if (/^[0-9a-f]{1,4}$/i.test(part)) words.push(Number.parseInt(part, 16));
    else {
      const ipv4 = part.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (!ipv4) return undefined;
      const octets = ipv4.slice(1).map(Number);
      if (octets.some((octet) => octet > 255)) return undefined;
      words.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
    }
  }
  return words;
}
