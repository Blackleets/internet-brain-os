import { createHash } from 'node:crypto';
import { AgentMissionExecutor as LegacyAgentMissionExecutor } from './agent-mission-executor-legacy.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { InboxError } from './page-context-inbox.mjs';

const MAX_SEARCH_CANDIDATES = 20;

export class AgentMissionExecutor extends LegacyAgentMissionExecutor {
  constructor(store, opportunityProjector, options = {}) {
    super(store, opportunityProjector, options);
    this.candidateVerifier = options.candidateVerifier ?? new MissionSearchCandidateVerifier(store, opportunityProjector, options.verifierOptions);
  }

  async complete(missionId, input) {
    if (input?.resultKind === 'verify_candidates') {
      const verified = await this.candidateVerifier.verify(missionId);
      return { ...verified, findings: verified.evidence ?? [] };
    }
    if (input?.resultKind === 'search_candidates') {
      return this.#recordSearchCandidates(missionId, input);
    }
    // FAIL-CLOSE: Hermes/snippet findings are not Evidence. Do not inherit
    // legacy complete(), which previously sealed Completado from ingested text.
    throw refuseSnippetCompletion();
  }

  async #recordSearchCandidates(missionId, input) {
    const leaseId = clean(input?.leaseId, 80, 'leaseId');
    if (!Array.isArray(input?.findings) || input.findings.length > MAX_SEARCH_CANDIDATES) {
      throw invalid(`findings must be an array with at most ${MAX_SEARCH_CANDIDATES} items`);
    }
    const normalized = dedupeByUrl(input.findings.map(normalizeCandidate));
    const digest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');

    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      if (current?.executionPhase === 'verifying' && current.searchCandidateDigest === digest) {
        return { changed: false, data, result: { mission: current, findings: current.searchCandidates ?? [], idempotent: true } };
      }
      requireActiveLease(current, leaseId, this.now());
      const now = this.now().toISOString();

      if (normalized.length === 0) {
        const completed = {
          ...current,
          status: 'completed',
          completedAt: now,
          limitation: 'Public discovery completed with no candidates',
          resultSummary: { received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 },
        };
        delete completed.executionPhase;
        delete completed.leaseId;
        delete completed.leaseExpiresAt;
        delete completed.searchCandidates;
        delete completed.searchCandidateDigest;
        const updated = [...missions];
        updated[index] = completed;
        return { changed: true, data: { ...data, agentMissions: updated }, result: { mission: completed, findings: [] } };
      }

      const candidates = normalized.map((candidate) => ({
        ...candidate,
        id: `search-candidate:${createHash('sha256').update(`${missionId}\n${candidate.url}`).digest('hex')}`,
        status: 'pending_verification',
      }));
      const verifying = {
        ...current,
        status: 'running',
        executionPhase: 'verifying',
        verifyingAt: now,
        searchCandidates: candidates,
        searchCandidateDigest: digest,
        limitation: 'Search candidates await Kernel web.read verification',
        resultSummary: { received: input.findings.length, evidenceCreated: 0, opportunitiesPromoted: 0 },
      };
      delete verifying.leaseId;
      delete verifying.leaseExpiresAt;
      const updated = [...missions];
      updated[index] = verifying;
      return { changed: true, data: { ...data, agentMissions: updated }, result: { mission: verifying, findings: candidates } };
    });
  }
}

function normalizeCandidate(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`finding ${index} must be an object`);
  const rawUrl = clean(value.url, 2048, `finding ${index} url`);
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw invalid(`finding ${index} URL is invalid`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid(`finding ${index} URL must be public HTTP(S)`);
  if (isPrivateLiteralHost(parsed.hostname)
    || [...parsed.searchParams.keys()].some((key) => /^(?:token|access_token|auth|authorization|api[_-]?key|code|session|signature|sig)$/i.test(key))) {
    throw invalid(`finding ${index} URL contains private or sensitive data`);
  }
  return {
    url: parsed.href,
    title: clean(value.title, 240, `finding ${index} title`),
    snippet: clean(value.text, 20_000, `finding ${index} text`),
    ...(value.summary === undefined ? {} : { summary: clean(value.summary, 500, `finding ${index} summary`) }),
    ...(value.discoveredAt === undefined ? {} : { discoveredAt: normalizeDate(value.discoveredAt) }),
  };
}

function dedupeByUrl(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value.url)) return false;
    seen.add(value.url);
    return true;
  });
}

function requireActiveLease(mission, leaseId, now) {
  if (!mission) throw new InboxError('AGENT_MISSION_NOT_FOUND', 'Agent mission was not found', 404);
  if (mission.status !== 'running' || mission.leaseId !== leaseId || Date.parse(mission.leaseExpiresAt) <= now.getTime()) {
    throw new InboxError('AGENT_MISSION_LEASE_INVALID', 'Agent mission lease is invalid or expired', 409);
  }
}

function clean(value, max, field) {
  if (typeof value !== 'string') throw invalid(`${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw invalid(`${field} is invalid`);
  return result;
}

function normalizeDate(value) {
  const result = clean(value, 40, 'discoveredAt');
  if (!Number.isFinite(Date.parse(result))) throw invalid('discoveredAt must be an ISO timestamp');
  return new Date(result).toISOString();
}

function isPrivateLiteralHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b, c, d] = ipv4.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part < 0 || part > 255)) return true;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function refuseSnippetCompletion() {
  return new InboxError(
    'AGENT_FINDINGS_NOT_EVIDENCE',
    'Hermes findings are not Evidence. Completado requires Kernel SUPPORT on fetched page content.',
    409,
  );
}

function invalid(message) {
  return new InboxError('INVALID_AGENT_RESULT', message, 400);
}
