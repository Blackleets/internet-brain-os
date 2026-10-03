import { createHash } from 'node:crypto';
import { AgentMissionExecutor as LegacyAgentMissionExecutor } from './agent-mission-executor-legacy.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { InboxError } from './page-context-inbox.mjs';

const MAX_SEARCH_CANDIDATES = 20;
export const SEARCH_TELEMETRY_SCHEMA = 'efesto.mission-search-telemetry.v1';
const MAX_TELEMETRY_SEARCHES = 8;
const MAX_TELEMETRY_QUERY_CHARS = 300;
const MAX_TELEMETRY_LIMIT = 100;
const MAX_TELEMETRY_RESULT_COUNT = 1000;

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
    // The digest (duplicate/idempotency check) covers the candidates only: telemetry is display-only.
    const digest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const searchTelemetry = normalizeSearchTelemetry(input?.searchTelemetry);

    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      if (current?.executionPhase === 'verifying' && current.searchCandidateDigest === digest) {
        return { changed: false, data, result: { mission: current, findings: current.searchCandidates ?? [], idempotent: true } };
      }
      requireActiveLease(current, leaseId, this.now());
      const now = this.now().toISOString();
      const telemetry = searchTelemetry ? { searchTelemetry: { ...searchTelemetry, recordedAt: now } } : {};

      if (normalized.length === 0) {
        const completed = {
          ...withoutSearchTelemetry(current),
          ...telemetry,
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
        ...withoutSearchTelemetry(current),
        ...telemetry,
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

/**
 * Optional, display-only record of the public searches the agent reported making
 * ({ searches: [{ query, limit?, resultCount? }] }). Bounded and validated; anything invalid drops
 * the whole record (never the results). It never feeds Evidence, web.read or SUPPORT.
 */
export function normalizeSearchTelemetry(value) {
  if (!isPlainObject(value) || !onlyKeys(value, ['searches'])) return undefined;
  const { searches } = value;
  if (!Array.isArray(searches) || searches.length === 0 || searches.length > MAX_TELEMETRY_SEARCHES) return undefined;
  const normalized = [];
  for (const search of searches) {
    if (!isPlainObject(search) || !onlyKeys(search, ['query', 'limit', 'resultCount'])) return undefined;
    if (typeof search.query !== 'string') return undefined;
    const query = search.query.replace(/\s+/g, ' ').trim();
    if (!query || query.length > MAX_TELEMETRY_QUERY_CHARS || /[\u0000-\u001f\u007f]/.test(query)) return undefined;
    const entry = { query };
    if (search.limit !== undefined) {
      if (!Number.isInteger(search.limit) || search.limit < 1 || search.limit > MAX_TELEMETRY_LIMIT) return undefined;
      entry.limit = search.limit;
    }
    if (search.resultCount !== undefined) {
      if (!Number.isInteger(search.resultCount) || search.resultCount < 0 || search.resultCount > MAX_TELEMETRY_RESULT_COUNT) return undefined;
      entry.resultCount = search.resultCount;
    }
    normalized.push(entry);
  }
  return { schemaVersion: SEARCH_TELEMETRY_SCHEMA, displayOnly: true, searches: normalized };
}

function withoutSearchTelemetry(mission) {
  if (!mission || !('searchTelemetry' in mission)) return mission;
  const { searchTelemetry: _previous, ...rest } = mission;
  return rest;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * A candidate URL must be a well-formed absolute http(s) URL as written, not merely something the
 * lenient WHATWG parser accepts. WHATWG happily parses markdown debris such as
 * `https://a.example/](https://a.example/page` into a path, so the raw string is checked first:
 * no whitespace, controls or RFC 3986-excluded characters, valid percent escapes, no `](`, and no
 * square brackets in the path (brackets are only legal in an IPv6 host literal). Non-ASCII
 * characters (IRIs) stay allowed; brackets stay allowed in the query, where real sites use them.
 */
export function isWellFormedAbsoluteHttpUrl(raw) {
  if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) return false;
  if (/[\s"<>\\^`{|}\u0000-\u001f\u007f]/.test(raw) || /%(?![0-9a-f]{2})/i.test(raw) || raw.includes('](')) return false;
  const afterScheme = raw.slice(raw.indexOf('//') + 2);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority = authorityEnd < 0 ? afterScheme : afterScheme.slice(0, authorityEnd);
  const rest = authorityEnd < 0 ? '' : afterScheme.slice(authorityEnd);
  const pathEnd = rest.search(/[?#]/);
  const path = pathEnd < 0 ? rest : rest.slice(0, pathEnd);
  if (/[[\]]/.test(path)) return false;
  if (/[[\]]/.test(authority) && !/^(?:[^@]*@)?\[[0-9a-f:.]+\](?::\d+)?$/i.test(authority)) return false;
  try {
    const parsed = new URL(raw);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch { return false; }
}

function normalizeCandidate(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`finding ${index} must be an object`);
  const rawUrl = clean(value.url, 2048, `finding ${index} url`);
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw invalid(`finding ${index} URL is invalid`); }
  if (['http:', 'https:'].includes(parsed.protocol) && !isWellFormedAbsoluteHttpUrl(rawUrl)) throw invalid(`finding ${index} URL is not a well-formed absolute HTTP(S) URL`);
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
  if (host === 'localhost' || host === '::1' || host === '::' || host.endsWith('.local')) return true;
  // Reuse Kernel/connector intent from packages/connectors/src/web-page.ts isPublicAddress:
  // loopback, unique-local fc00::/7, link-local fe80::/10, IPv4-mapped/translated ::ffff:[0:]x.x.x.x,
  // NAT64 well-known prefix 64:ff9b::/96, deprecated IPv4-compatible ::/96.
  if (host.includes(':') && (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd'))) return true;
  return isPrivateIpv4Literal(ipv4MappedFromLiteral(host) ?? host);
}

function ipv4MappedFromLiteral(host) {
  // NAT64 well-known prefix 64:ff9b::/96 (RFC 6052) — WHATWG: 64:ff9b::127.0.0.1 → 64:ff9b::7f00:1.
  const nat64Dotted = host.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
  if (nat64Dotted) return nat64Dotted[1];
  const nat64Hex = host.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (nat64Hex) {
    const hi = Number.parseInt(nat64Hex[1], 16);
    const lo = Number.parseInt(nat64Hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  const dotted = host.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  // WHATWG: mapped ::ffff:7f00:1; translated/SIIT ::ffff:0:7f00:1 — both embed private IPv4.
  const hex = host.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  // Deprecated IPv4-compatible ::/96 (RFC 4291) — same gate as packages/connectors web-page.ts.
  // WHATWG: ::127.0.0.1 → ::7f00:1; DNS may also return 0:0:0:0:0:0:7f00:1.
  const compatDotted = host.match(/^(?:0:0:0:0:0:0|:)?:(\d+\.\d+\.\d+\.\d+)$/);
  if (compatDotted) return compatDotted[1];
  const compatHex = host.match(/^(?:0:0:0:0:0:0|:)?:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!compatHex) return undefined;
  const hi = Number.parseInt(compatHex[1], 16);
  const lo = Number.parseInt(compatHex[2], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPrivateIpv4Literal(host) {
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
