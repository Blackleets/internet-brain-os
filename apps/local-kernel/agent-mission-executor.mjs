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
const MAX_TELEMETRY_PLANNED_QUERIES = 3;
// Result items a search returned (display-only: the forge shows the pages around the spider).
const MAX_TELEMETRY_RESULTS_PER_SEARCH = 10;
const MAX_TELEMETRY_RESULTS_TOTAL = 30;
const MAX_TELEMETRY_RESULT_TITLE_CHARS = 160;
const SENSITIVE_QUERY_KEY = /^(?:token|access_token|auth|authorization|api[_-]?key|code|session|signature|sig)$/i;
// Funnel counts are bounded by the adapter contract (at most 20 findings per Hermes answer).
const MAX_TELEMETRY_FINDINGS = 20;
export const FUNNEL_DROP_REASONS = Object.freeze(['malformed_url', 'per_domain_cap', 'duplicate', 'other']);

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
    const searchTelemetry = normalizeSearchTelemetry(input?.searchTelemetry, { findingsSubmitted: input.findings.length });

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
 * Optional, display-only record of the agent's public search work:
 *   { searches: [{ query, limit?, resultCount? }], plannedQueries?: string[],
 *     funnel?: { findingsReturned, dropped: { malformed_url?, per_domain_cap?, duplicate?, other? } } }
 * `searches` are the queries really sent; `plannedQueries` the ones the adapter asked for. The Kernel
 * itself marks each search `matchesPlan` (exact match after whitespace collapse), so a rewritten
 * query is visible. The funnel must add up: findingsReturned − dropped = findings submitted.
 * Bounded and validated; anything invalid drops the whole record (never the results). It never
 * feeds Evidence, web.read or SUPPORT.
 */
export function normalizeSearchTelemetry(value, { findingsSubmitted } = {}) {
  if (!isPlainObject(value) || !onlyKeys(value, ['searches', 'plannedQueries', 'funnel'])) return undefined;
  const { searches } = value;
  const hasPlan = value.plannedQueries !== undefined;
  const hasFunnel = value.funnel !== undefined;
  // No searches at all is only worth recording next to a plan or a funnel ("planned 3, sent 0").
  if (!Array.isArray(searches) || searches.length > MAX_TELEMETRY_SEARCHES) return undefined;
  if (searches.length === 0 && !hasPlan && !hasFunnel) return undefined;
  let plannedQueries;
  if (hasPlan) {
    if (!Array.isArray(value.plannedQueries) || value.plannedQueries.length === 0 || value.plannedQueries.length > MAX_TELEMETRY_PLANNED_QUERIES) return undefined;
    plannedQueries = [];
    for (const planned of value.plannedQueries) {
      const query = telemetryQuery(planned);
      if (!query || plannedQueries.includes(query)) return undefined;
      plannedQueries.push(query);
    }
  }
  const normalized = [];
  let totalResults = 0;
  for (const search of searches) {
    if (!isPlainObject(search) || !onlyKeys(search, ['query', 'limit', 'resultCount', 'results'])) return undefined;
    const query = telemetryQuery(search.query);
    if (!query) return undefined;
    const entry = { query };
    if (search.limit !== undefined) {
      if (!Number.isInteger(search.limit) || search.limit < 1 || search.limit > MAX_TELEMETRY_LIMIT) return undefined;
      entry.limit = search.limit;
    }
    if (search.resultCount !== undefined) {
      if (!Number.isInteger(search.resultCount) || search.resultCount < 0 || search.resultCount > MAX_TELEMETRY_RESULT_COUNT) return undefined;
      entry.resultCount = search.resultCount;
    }
    if (search.results !== undefined) {
      const results = telemetryResults(search.results);
      if (!results) return undefined;
      if (entry.resultCount !== undefined && results.length > entry.resultCount) return undefined;
      totalResults += results.length;
      if (totalResults > MAX_TELEMETRY_RESULTS_TOTAL) return undefined;
      entry.results = results;
    }
    if (plannedQueries) entry.matchesPlan = plannedQueries.includes(query);
    normalized.push(entry);
  }
  let funnel;
  if (hasFunnel) {
    funnel = normalizeFunnel(value.funnel, findingsSubmitted);
    if (!funnel) return undefined;
  }
  return {
    schemaVersion: SEARCH_TELEMETRY_SCHEMA,
    displayOnly: true,
    searches: normalized,
    ...(plannedQueries ? { plannedQueries } : {}),
    ...(funnel ? { funnel } : {}),
  };
}

/**
 * `results` of one search: [{ url, title? }], at most 10 per search and 30 in total. Display-only (the
 * forge draws them around the spider); never Evidence, never web.read input, never SUPPORT. Each URL
 * must be a well-formed public http(s) URL without credentials, private literal hosts or
 * sensitive query keys; the title is plain text. Anything invalid drops the whole telemetry record.
 */
function telemetryResults(value) {
  if (!Array.isArray(value) || value.length > MAX_TELEMETRY_RESULTS_PER_SEARCH) return undefined;
  const results = [];
  for (const item of value) {
    if (!isPlainObject(item) || !onlyKeys(item, ['url', 'title'])) return undefined;
    const url = publicTelemetryUrl(item.url);
    if (!url || results.some((existing) => existing.url === url)) return undefined;
    const entry = { url };
    if (item.title !== undefined) {
      if (typeof item.title !== 'string') return undefined;
      const title = item.title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
      if (title.length > MAX_TELEMETRY_RESULT_TITLE_CHARS) return undefined;
      if (title) entry.title = title;
    }
    results.push(entry);
  }
  return results;
}

function publicTelemetryUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || !isWellFormedAbsoluteHttpUrl(raw)) return undefined;
  let parsed;
  try { parsed = new URL(raw); } catch { return undefined; }
  if (parsed.username || parsed.password || isPrivateLiteralHost(parsed.hostname)) return undefined;
  if ([...parsed.searchParams.keys()].some((key) => SENSITIVE_QUERY_KEY.test(key))) return undefined;
  return parsed.href;
}

function telemetryQuery(value) {
  if (typeof value !== 'string') return undefined;
  const query = value.replace(/\s+/g, ' ').trim();
  if (!query || query.length > MAX_TELEMETRY_QUERY_CHARS || /[\u0000-\u001f\u007f]/.test(query)) return undefined;
  return query;
}

function normalizeFunnel(value, findingsSubmitted) {
  if (!isPlainObject(value) || !onlyKeys(value, ['findingsReturned', 'dropped'])) return undefined;
  const count = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_TELEMETRY_FINDINGS;
  if (!count(value.findingsReturned)) return undefined;
  const rawDropped = value.dropped ?? {};
  if (!isPlainObject(rawDropped) || !onlyKeys(rawDropped, FUNNEL_DROP_REASONS)) return undefined;
  const dropped = {};
  let total = 0;
  for (const reason of FUNNEL_DROP_REASONS) {
    if (rawDropped[reason] === undefined) continue;
    if (!count(rawDropped[reason])) return undefined;
    dropped[reason] = rawDropped[reason];
    total += rawDropped[reason];
  }
  if (total > value.findingsReturned) return undefined;
  // The counts must describe this very batch, or they would misreport what happened.
  if (!Number.isInteger(findingsSubmitted) || value.findingsReturned - total !== findingsSubmitted) return undefined;
  return { findingsReturned: value.findingsReturned, dropped };
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
    || [...parsed.searchParams.keys()].some((key) => SENSITIVE_QUERY_KEY.test(key))) {
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
