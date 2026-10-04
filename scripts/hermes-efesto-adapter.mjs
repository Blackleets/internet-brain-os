import { spawn } from 'node:child_process';
import { chmod, copyFile, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_INPUT_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 12 * 60_000;
const MAX_TIMEOUT_MS = 25 * 60_000;
const FORCE_KILL_DELAY_MS = 500;
const MAX_AGENT_TURNS = 8;
const DEFAULT_AGENT_TURNS = 8;
// Discovery breadth: 2–3 phrasings × 10 results, 5–10 findings from varied domains.
const MIN_SEARCHES = 2;
const MAX_SEARCH_CALLS = 3;
const SEARCH_LIMIT = 10;
const MIN_FINDINGS = 5;
const MAX_FINDINGS = 10;
const MAX_PER_HOST = 2;
// Search telemetry (display-only): Hermes web_tools debug log, read from the isolated home before cleanup.
const WEB_TOOLS_DEBUG_PREFIX = 'web_tools_debug_';
const MAX_DEBUG_LOG_BYTES = 256 * 1024;
const MAX_SEARCHES = 8;
const MAX_QUERY_CHARS = 300;

// Filler words that carry no topic; they are never required in a search phrasing.
const GOAL_STOPWORDS = new Set([
  'a', 'al', 'an', 'and', 'ayuda', 'busco', 'buscar', 'como', 'con', 'de', 'del', 'el', 'en', 'encontrar', 'find', 'for',
  'help', 'i', 'in', 'la', 'las', 'lo', 'los', 'looking', 'me', 'mi', 'my', 'necesito', 'need', 'o', 'of', 'or', 'para',
  'please', 'por', 'que', 'quiero', 'some', 'the', 'to', 'un', 'una', 'unos', 'unas', 'want', 'with', 'y',
]);
const MAX_CORE_TERMS = 8;

/** Topic terms of the Goal (scope keywords, else Goal title words) minus filler, for query anchoring. */
export function goalCoreTerms(mission) {
  const scope = mission?.scope ?? {};
  const keywords = Array.isArray(scope.keywords) ? scope.keywords.filter((value) => typeof value === 'string') : [];
  const source = keywords.length ? keywords : String(mission?.goalTitle ?? '').split(/[^\p{L}\p{N}]+/u);
  const terms = [];
  for (const raw of source.slice(0, 40)) {
    const term = raw.trim().toLowerCase().slice(0, 60);
    if (term.length < 2 || GOAL_STOPWORDS.has(term) || terms.includes(term)) continue;
    terms.push(term);
    if (terms.length === MAX_CORE_TERMS) break;
  }
  return terms;
}

const MAX_QUERY_TERMS = 6;
const MAX_PLANNED_QUERY_CHARS = 160;

/**
 * The 2–3 queries the adapter asks Hermes to send, built deterministically from the Goal's own
 * words: its core terms (filler removed, at most 6), then variants that drop the first or last term,
 * or add the Location when one is set and not already a term. Nothing is invented — no years,
 * numbers, synonyms, translations or spelling fixes — and duplicates are removed. A Goal with only
 * one or two usable terms and no Location yields a single query.
 */
export function planSearchQueries(mission) {
  const scope = mission?.scope ?? {};
  const terms = goalCoreTerms(mission).slice(0, MAX_QUERY_TERMS);
  const location = cleanQueryText(scope.location, 60);
  const base = terms.length ? terms.join(' ') : cleanQueryText(mission?.goalTitle, 120);
  if (!base) return [];
  const addLocation = location && !base.toLowerCase().split(' ').includes(location.toLowerCase()) && !base.toLowerCase().includes(location.toLowerCase());
  const variants = addLocation
    ? [base, `${base} ${location}`, terms.length >= 3 ? `${terms.slice(1).join(' ')} ${location}` : undefined]
    : [base, terms.length >= 3 ? terms.slice(1).join(' ') : undefined, terms.length >= 3 ? terms.slice(0, -1).join(' ') : undefined];
  const planned = [];
  for (const variant of variants) {
    const query = cleanQueryText(variant, MAX_PLANNED_QUERY_CHARS);
    if (query && !planned.some((item) => item.toLowerCase() === query.toLowerCase())) planned.push(query);
  }
  return planned.slice(0, MAX_SEARCH_CALLS);
}

function cleanQueryText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

export function buildHermesPrompt(payload) {
  if (!payload || payload.schemaVersion !== 'efesto.hermes-mission.v1' || !payload.mission) {
    throw new Error('Expected one efesto.hermes-mission.v1 mission object');
  }
  const mission = payload.mission;
  const scope = mission.scope ?? {};
  const coreTerms = goalCoreTerms(mission);
  const planned = planSearchQueries(mission);
  const searchLines = planned.length
    ? [
      `Make exactly ${planned.length} web_search ${planned.length === 1 ? 'call' : 'calls'}, one per query below and in this order, each with "limit": ${SEARCH_LIMIT}. Use each query string exactly as written: do not translate, correct, reorder, extend or add words, years or numbers, and make no other search. Then return the final JSON. Do not call any other tool.`,
      ...planned.map((query, index) => `Query ${index + 1}: ${JSON.stringify(query)}`),
    ]
    : [`Make ${MIN_SEARCHES} or ${MAX_SEARCH_CALLS} public web_search calls, each with "limit": ${SEARCH_LIMIT}, using the Goal's own words without adding years or numbers. Then return the final JSON. Do not call any other tool.`];
  return [
    '/no_think',
    'You are executing one bounded public-source discovery mission for Efesto.',
    'Use only public web search. The returned snippets are candidates, not verified Evidence.',
    'Do not access local files, private networks, credentials, messaging history, private sessions, browser automation or computer-use.',
    'Do not perform purchases, submissions, logins, outreach, downloads or destructive actions.',
    'Prefer canonical, directly readable public pages with substantive content; avoid login walls, paywalls, redirectors, search-result pages and JavaScript-only shells.',
    ...searchLines,
    `From those results, return ${MIN_FINDINGS} to ${MAX_FINDINGS} relevant findings about the Goal itself when public search supports them, from varied source domains (at most ${MAX_PER_HOST} per domain); no companies, brands or topics that are not in the Goal.`,
    'Return ONLY one valid JSON object with this exact shape: {"findings":[{"url":"https://public.example/path"}]}.',
    'Each finding must contain exactly one field: url. Do not copy titles, snippets, summaries, dates, or other prose from the search result. Keep every URL on one line, escape it as JSON, and do not use trailing commas.',
    'Use at most 20 findings. URLs must be public http or https. Do not include markdown fences or commentary.',
    '',
    `Mission id: ${String(mission.id ?? '').slice(0, 160)}`,
    `Goal: ${String(mission.goalTitle ?? '').slice(0, 500)}`,
    `Categories: ${JSON.stringify(Array.isArray(scope.categories) ? scope.categories.slice(0, 20) : [])}`,
    `Keywords: ${JSON.stringify(Array.isArray(scope.keywords) ? scope.keywords.slice(0, 40) : [])}`,
    `Core Goal terms: ${JSON.stringify(coreTerms)}`,
    `Location: ${String(scope.location ?? '').slice(0, 240)}`,
    `Cadence: ${String(mission.cadence ?? '').slice(0, 80)}`,
  ].join('\n');
}

export function buildHermesArgs(prompt, maxTurns = DEFAULT_AGENT_TURNS, provider, model) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Hermes prompt is required');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > MAX_AGENT_TURNS) throw new Error(`Hermes max turns must be an integer between 1 and ${MAX_AGENT_TURNS}`);
  const normalizedProvider = normalizeRouteValue(provider, 'provider');
  const normalizedModel = normalizeRouteValue(model, 'model');
  const route = [
    ...(normalizedProvider ? ['--provider', normalizedProvider] : []),
    ...(normalizedModel ? ['--model', normalizedModel] : []),
  ];
  return ['chat', '--query', prompt, '--quiet', '--max-turns', String(maxTurns), ...route, '--ignore-rules', '--toolsets', 'search'];
}

function normalizeRouteValue(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`Hermes ${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 160 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`Hermes ${label} is invalid`);
  return normalized;
}

export function buildHermesEnvironment(baseEnv, hermesHome) {
  if (typeof hermesHome !== 'string' || !hermesHome.trim()) throw new Error('An isolated Hermes home is required');
  const env = {
    ...baseEnv,
    HERMES_HOME: hermesHome,
    HERMES_ALLOW_PRIVATE_URLS: 'false',
    HERMES_IGNORE_RULES: '1',
    // Records each web_search call (query, limit, result count; no result content) to
    // $HERMES_HOME/logs so the adapter can report what Hermes actually searched.
    WEB_TOOLS_DEBUG: 'true',
  };
  delete env.HERMES_SAFE_MODE;
  delete env.HERMES_ENABLE_PROJECT_PLUGINS;
  return env;
}

export async function prepareHermesHome(hermesHome, maxTurns = DEFAULT_AGENT_TURNS, provider, model) {
  if (typeof hermesHome !== 'string' || !hermesHome.trim()) throw new Error('An isolated Hermes home is required');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > MAX_AGENT_TURNS) throw new Error(`Hermes max turns must be an integer between 1 and ${MAX_AGENT_TURNS}`);
  const normalizedProvider = normalizeRouteValue(provider, 'provider');
  const normalizedModel = normalizeRouteValue(model, 'model');
  const configPath = join(hermesHome, 'config.yaml');
  const route = {
    ...(normalizedModel ? { default: normalizedModel } : {}),
    ...(normalizedProvider ? { provider: normalizedProvider } : {}),
  };
  const config = {
    agent: { max_turns: maxTurns },
    // Never let an auxiliary task (compression, vision, titles…) fall back to a paid OpenRouter
    // model, and skip session-title generation, which only costs an extra model call per run.
    auxiliary: { free_only: true, title_generation: { enabled: false } },
    ...(Object.keys(route).length > 0 ? { model: route } : {}),
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return configPath;
}

export function normalizeHermesExecutable(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Hermes executable is required');
  const executable = value.trim();
  return isAbsolute(executable) || executable.includes('/') || executable.includes('\\')
    ? resolve(executable)
    : executable;
}

export function parseHermesFindings(text) {
  return { findings: parseHermesFindingsWithFunnel(text).findings };
}

/**
 * Same parse, plus the display-only findings funnel: how many findings Hermes returned and how
 * many the adapter dropped, by reason. Only counts; no URL or text from a dropped finding is kept.
 */
export function parseHermesFindingsWithFunnel(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Hermes returned empty output');
  const trimmed = text.trim();
  const withoutThinking = trimmed.replace(/^(?:<think>[\s\S]*?<\/think>\s*)+/i, '');
  const fence = /^```\s*(?:json\s*)?/i.exec(withoutThinking);
  const fencedBody = fence ? withoutThinking.slice(fence[0].length) : withoutThinking;
  const closingFence = fence ? fencedBody.indexOf('```') : -1;
  const candidate = (closingFence >= 0 ? fencedBody.slice(0, closingFence) : fencedBody).trim();
  let parsed;
  let repaired = false;
  try { parsed = JSON.parse(candidate); }
  catch {
    const repairedCandidate = repairHermesJson(candidate);
    repaired = repairedCandidate !== candidate;
    try { parsed = JSON.parse(repairedCandidate); }
    catch {
      const urls = extractLiteralWebUrls(withoutThinking);
      if (urls.length > 0) parsed = { findings: urls.map((url) => ({ url })) };
      else {
        const shape = `chars=${trimmed.length} think=${trimmed.startsWith('<think>')} fence=${withoutThinking.startsWith('```')} findings=${/\{\s*"findings"\s*:/.test(candidate)} repair=${repaired} urls=0`;
        throw new Error(`Hermes did not return valid JSON or literal web URLs (${shape})`);
      }
    }
  }
  if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length > 20) {
    throw new Error('Hermes must return { findings: [...] } with at most 20 findings');
  }
  // A finding whose http(s) URL is malformed and cannot be recovered unambiguously is dropped, not
  // guessed; the Kernel rejects any URL that is not well-formed, so it would otherwise fail the batch.
  const normalized = parsed.findings.map((finding, index) => normalizeFinding(finding, index));
  const findings = normalized.filter(Boolean);
  const malformed = normalized.length - findings.length;
  return { findings, funnel: { findingsReturned: parsed.findings.length, dropped: malformed ? { malformed_url: malformed } : {} } };
}

/**
 * True for a well-formed absolute http(s) URL as written (mirrors the Kernel's candidate check):
 * no whitespace, controls or RFC 3986-excluded characters, valid percent escapes, no `](` and no
 * square brackets in the path. Non-ASCII characters and bracketed query keys stay allowed.
 */
export function isWellFormedWebUrl(raw) {
  if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw)) return false;
  if (/[\s"<>\\^`{|}\u0000-\u001f\u007f]/.test(raw) || /%(?![0-9a-f]{2})/i.test(raw) || raw.includes('](')) return false;
  const afterScheme = raw.slice(raw.indexOf('//') + 2);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority = authorityEnd < 0 ? afterScheme : afterScheme.slice(0, authorityEnd);
  const rest = authorityEnd < 0 ? '' : afterScheme.slice(authorityEnd);
  const pathEnd = rest.search(/[?#]/);
  if (/[[\]]/.test(pathEnd < 0 ? rest : rest.slice(0, pathEnd))) return false;
  if (/[[\]]/.test(authority) && !/^(?:[^@]*@)?\[[0-9a-f:.]+\](?::\d+)?$/i.test(authority)) return false;
  try {
    const parsed = new URL(raw);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch { return false; }
}

/**
 * Recovers the one URL a malformed agent string unambiguously points at, e.g. markdown debris
 * `https://a.example/](https://a.example/page` → `https://a.example/page` (the link target).
 * Every http(s) URL inside the string is collected; all of them must be on the same host (www.
 * ignored). The markdown target (right after `](`) wins; otherwise one URL that every other one is a
 * prefix of. Anything else is ambiguous and yields undefined; nothing is ever invented.
 */
export function recoverWebUrl(raw) {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().replace(/^<(.*)>$/s, '$1');
  if (isWellFormedWebUrl(value)) return value;
  const found = [];
  for (const match of value.matchAll(/https?:\/\/[^\s<>"'`\\[\]()]+/gi)) {
    // It must end where markup ends (string end, `)`, `]` or `>`): a URL cut short by a space or
    // a stray character would be a guess.
    const next = value[match.index + match[0].length];
    if (next !== undefined && !/[)\]>]/.test(next)) continue;
    const url = match[0].replace(/[.,;:!?]+$/, '');
    if (!isWellFormedWebUrl(url)) continue;
    found.push({ url, target: value.slice(Math.max(0, match.index - 2), match.index) === '](' });
  }
  if (found.length === 0) return undefined;
  const hosts = new Set(found.map(({ url }) => new URL(url).hostname.toLowerCase().replace(/^www\./, '')));
  if (hosts.size !== 1) return undefined;
  const targets = [...new Set(found.filter((item) => item.target).map((item) => item.url))];
  if (targets.length === 1) return targets[0];
  if (targets.length > 1) return undefined;
  const distinct = [...new Set(found.map((item) => item.url))];
  const longest = distinct.reduce((a, b) => (b.length > a.length ? b : a));
  return distinct.every((url) => longest.startsWith(url)) ? longest : undefined;
}

/**
 * Keeps the agent's order but drops repeated URLs, keeps at most MAX_PER_HOST findings per domain
 * (www. ignored) and at most MAX_FINDINGS overall. It only removes candidates, never adds one.
 */
export function diversifyFindings(findings, options) {
  return diversifyFindingsWithCounts(findings, options).findings;
}

/** diversifyFindings plus how many findings it removed, by reason (counts only). */
export function diversifyFindingsWithCounts(findings, { maxPerHost = MAX_PER_HOST, max = MAX_FINDINGS } = {}) {
  const dropped = { duplicate: 0, per_domain_cap: 0, other: 0 };
  if (!Array.isArray(findings)) return { findings: [], dropped: {} };
  const perHost = new Map();
  const seen = new Set();
  const kept = [];
  for (const finding of findings) {
    // beyond the overall cap
    if (kept.length >= max) { dropped.other += 1; continue; }
    let host;
    try { host = new URL(finding.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { dropped.other += 1; continue; }
    if (seen.has(finding.url)) { dropped.duplicate += 1; continue; }
    const count = perHost.get(host) ?? 0;
    if (count >= maxPerHost) { dropped.per_domain_cap += 1; continue; }
    seen.add(finding.url);
    perHost.set(host, count + 1);
    kept.push(finding);
  }
  return { findings: kept, dropped: Object.fromEntries(Object.entries(dropped).filter(([, n]) => n > 0)) };
}

/** Funnel for the batch actually sent: findingsReturned − all drops = findings.length. */
export function mergeFindingsFunnel(funnel, extraDropped) {
  const dropped = { ...(funnel?.dropped ?? {}) };
  for (const [reason, n] of Object.entries(extraDropped ?? {})) dropped[reason] = (dropped[reason] ?? 0) + n;
  return { findingsReturned: funnel?.findingsReturned ?? 0, dropped };
}

function extractLiteralWebUrls(text) {
  const matches = String(text ?? '').replace(/\\\//g, '/').match(/https?:\/\/[^\s<>"'`\\]+/gi) ?? [];
  const unique = [];
  const seen = new Set();
  for (const match of matches) {
    const candidate = match.replace(/[)\]}>.,;:!?]+$/g, '');
    if (!candidate || seen.has(candidate)) continue;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) continue;
    } catch { continue; }
    seen.add(candidate);
    unique.push(candidate);
  }
  return unique;
}

function repairHermesJson(candidate) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index];
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else if (char === '\\') {
        const next = candidate[index + 1] ?? '';
        if (/^["\\/bfnrtu]$/.test(next)) {
          result += char;
          escaped = true;
        } else result += '\\\\';
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') result += '\\n';
      else if (char === '\r') result += '\\r';
      else if (char === '\t') result += '\\t';
      else result += char;
      continue;
    }
    if (char === '"') {
      result += char;
      inString = true;
      continue;
    }
    if (char === ',') {
      let cursor = index + 1;
      while (/\s/.test(candidate[cursor] ?? '')) cursor += 1;
      if (candidate[cursor] === ']' || candidate[cursor] === '}') continue;
    }
    result += char;
  }
  return result;
}

function normalizeFinding(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`finding ${index} must be an object`);
  const allowed = new Set(['url', 'title', 'text', 'summary', 'discoveredAt']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`finding ${index} contains unsupported field ${key}`);
  const rawUrl = bounded(value.url, 2048, `finding ${index} url`);
  const url = recoverWebUrl(rawUrl);
  if (!url) {
    // Not even a recoverable http(s) URL: a non-web scheme stays a hard error (security contract);
    // malformed http(s) text is dropped from the batch.
    if (!/https?:\/\//i.test(rawUrl)) throw new Error(`finding ${index} url must be public http or https`);
    return undefined;
  }
  const parsedUrl = new URL(url);
  return {
    url,
    title: value.title === undefined ? `Public source: ${parsedUrl.hostname}` : bounded(value.title, 240, `finding ${index} title`),
    text: value.text === undefined ? 'Public source candidate pending Kernel verification.' : bounded(value.text, 20_000, `finding ${index} text`),
    ...(value.summary === undefined ? {} : { summary: bounded(value.summary, 500, `finding ${index} summary`) }),
    ...(value.discoveredAt === undefined ? {} : { discoveredAt: bounded(value.discoveredAt, 40, `finding ${index} discoveredAt`) }),
  };
}

function bounded(value, max, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid`);
  return result;
}

function configuredTimeout(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60_000 || parsed > MAX_TIMEOUT_MS) {
    throw new Error('HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS must be between 60000 and 1500000');
  }
  return parsed;
}


const HERMES_CREDENTIAL_FILES = Object.freeze(['auth.json', '.env', '.anthropic_oauth.json']);

export function resolveSourceHermesHome(env = process.env) {
  const explicit = typeof env.HERMES_HOME === 'string' ? env.HERMES_HOME.trim() : '';
  if (explicit) return explicit;
  if (typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA.trim()) return join(env.LOCALAPPDATA, 'hermes');
  if (typeof env.HOME === 'string' && env.HOME.trim()) return join(env.HOME, '.hermes');
  return '';
}

export async function seedIsolatedHermesCredentials(isolatedHome, sourceHome, copiedNames) {
  const copied = Array.isArray(copiedNames) ? copiedNames : [];
  if (typeof isolatedHome !== 'string' || !isolatedHome.trim() || typeof sourceHome !== 'string' || !sourceHome.trim()) {
    return copied;
  }
  if (resolve(isolatedHome) === resolve(sourceHome)) return copied;
  for (const name of HERMES_CREDENTIAL_FILES) {
    const from = join(sourceHome, name);
    const to = join(isolatedHome, name);
    try {
      await copyFile(from, to);
      try { await chmod(to, 0o600); } catch {}
      copied.push(name);
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) continue;
      throw error;
    }
  }
  return copied;
}

export async function wipeCopiedHermesCredentials(isolatedHome, copiedNames) {
  if (typeof isolatedHome !== 'string' || !isolatedHome.trim() || !Array.isArray(copiedNames) || copiedNames.length === 0) return;
  const allowed = new Set(HERMES_CREDENTIAL_FILES);
  for (const name of copiedNames) {
    if (!allowed.has(name)) continue;
    try { await unlink(join(isolatedHome, name)); }
    catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) continue;
    }
  }
}


export function parseTopLevelHermesModelRoute(configText) {
  if (typeof configText !== 'string' || !configText.trim()) return undefined;
  try {
    const parsed = JSON.parse(configText);
    if (parsed?.model && typeof parsed.model === 'object' && !Array.isArray(parsed.model)) {
      return sanitizeModelRoute(parsed.model);
    }
  } catch {}
  const lines = configText.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== 'model:') return undefined;
  const route = {};
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/^[ \t]/.test(line) || !line.trim()) break;
    const match = line.match(/^[ \t]+([A-Za-z0-9_]+):\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^['"]|['"]$/g, '');
    if (['default', 'provider', 'base_url'].includes(key) && value && value !== '[]' && value !== '{}') route[key] = value;
  }
  return Object.keys(route).length ? route : undefined;
}

function sanitizeModelRoute(model) {
  const route = {};
  for (const key of ['default', 'provider', 'base_url']) {
    if (typeof model[key] === 'string' && model[key].trim() && model[key].length <= 240 && !/[\u0000-\u001f\u007f]/.test(model[key])) {
      route[key] = model[key].trim();
    }
  }
  return Object.keys(route).length ? route : undefined;
}

export async function applySourceHermesModelRoute(isolatedHome, sourceHome) {
  if (typeof isolatedHome !== 'string' || !isolatedHome.trim() || typeof sourceHome !== 'string' || !sourceHome.trim()) return undefined;
  if (resolve(isolatedHome) === resolve(sourceHome)) return undefined;
  const isolatedPath = join(isolatedHome, 'config.yaml');
  let isolated;
  try { isolated = JSON.parse(await readFile(isolatedPath, 'utf8')); }
  catch { return undefined; }
  if (isolated?.model && typeof isolated.model === 'object' && Object.keys(isolated.model).length) return isolated.model;
  let sourceText;
  try { sourceText = await readFile(join(sourceHome, 'config.yaml'), 'utf8'); }
  catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return undefined;
    throw error;
  }
  const route = parseTopLevelHermesModelRoute(sourceText);
  if (!route) return undefined;
  isolated.model = route;
  await writeFile(isolatedPath, `${JSON.stringify(isolated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return route;
}

export async function runHermesOneShot(payload, options = {}) {
  const executable = normalizeHermesExecutable(options.executable ?? process.env.HEPHAESTUS_HERMES_EXECUTABLE ?? 'hermes');
  const prompt = buildHermesPrompt(payload);
  const plannedQueries = planSearchQueries(payload.mission);
  const timeoutMs = options.timeoutMs ?? configuredTimeout(process.env.HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const ownsHermesHome = options.hermesHome === undefined;
  const hermesHome = options.hermesHome ?? await mkdtemp(join(tmpdir(), 'efesto-hermes-'));
  const baseEnv = options.env ?? process.env;
  const maxTurns = configuredMaxTurns(options.maxTurns ?? baseEnv.HEPHAESTUS_HERMES_MAX_TURNS);
  const args = buildHermesArgs(prompt, maxTurns, baseEnv.HERMES_INFERENCE_PROVIDER, baseEnv.HERMES_INFERENCE_MODEL);
  const copied = [];
  try {
    await prepareHermesHome(hermesHome, maxTurns, baseEnv.HERMES_INFERENCE_PROVIDER, baseEnv.HERMES_INFERENCE_MODEL);
    const sourceHome = resolveSourceHermesHome(baseEnv);
    await seedIsolatedHermesCredentials(hermesHome, sourceHome, copied);
    await applySourceHermesModelRoute(hermesHome, sourceHome);
    const result = await runHermesProcess({
      executable,
      args,
      timeoutMs,
      env: buildHermesEnvironment(baseEnv, hermesHome),
      cwd: hermesHome,
    });
    const searches = await collectHermesSearchTelemetry(hermesHome);
    const diverse = diversifyFindingsWithCounts(result.findings);
    const funnel = mergeFindingsFunnel(result.funnel, diverse.dropped);
    return {
      ...result,
      findings: diverse.findings,
      ...(searches.length ? { searches } : {}),
      ...(plannedQueries.length ? { plannedQueries } : {}),
      funnel,
    };
  } finally {
    await wipeCopiedHermesCredentials(hermesHome, copied);
    if (ownsHermesHome) {
      await rm(hermesHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
}

/**
 * Reads the Hermes web_tools debug logs in the isolated home and returns the web_search calls
 * Hermes really made: { query, limit?, resultCount? }. A field the log does not carry (or carries
 * malformed) is omitted, never guessed; resultCount is omitted for a call that errored. The logs
 * are removed after reading. Telemetry is best effort: any read/parse problem yields [] and never
 * fails the mission.
 */
export async function collectHermesSearchTelemetry(hermesHome) {
  if (typeof hermesHome !== 'string' || !hermesHome.trim()) return [];
  const logDir = join(hermesHome, 'logs');
  let names;
  try { names = (await readdir(logDir)).filter((name) => name.startsWith(WEB_TOOLS_DEBUG_PREFIX) && name.endsWith('.json')).sort(); }
  catch { return []; }
  const calls = [];
  for (const name of names) {
    const path = join(logDir, name);
    try {
      const info = await stat(path);
      if (info.isFile() && info.size <= MAX_DEBUG_LOG_BYTES) {
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        if (Array.isArray(parsed?.tool_calls)) calls.push(...parsed.tool_calls);
      }
    } catch { /* unreadable log: no telemetry from it */ }
    try { await unlink(path); } catch { /* already gone */ }
  }
  return parseHermesSearchCalls(calls);
}

export function parseHermesSearchCalls(calls) {
  if (!Array.isArray(calls)) return [];
  const searches = [];
  for (const call of calls) {
    if (searches.length >= MAX_SEARCHES) break;
    if (!call || typeof call !== 'object' || call.tool_name !== 'web_search_tool') continue;
    const parameters = call.parameters && typeof call.parameters === 'object' ? call.parameters : {};
    const query = typeof parameters.query === 'string' ? parameters.query.replace(/\s+/g, ' ').trim() : '';
    if (!query || query.length > MAX_QUERY_CHARS || /[\u0000-\u001f\u007f]/.test(query)) continue;
    const search = { query };
    if (Number.isInteger(parameters.limit) && parameters.limit >= 1 && parameters.limit <= 100) search.limit = parameters.limit;
    if ((call.error === null || call.error === undefined) && Number.isInteger(call.results_count) && call.results_count >= 0 && call.results_count <= 1000) {
      search.resultCount = call.results_count;
    }
    searches.push(search);
  }
  return searches;
}

function configuredMaxTurns(value) {
  if (value === undefined || value === '') return DEFAULT_AGENT_TURNS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_AGENT_TURNS) {
    throw new Error(`HEPHAESTUS_HERMES_MAX_TURNS must be an integer between 1 and ${MAX_AGENT_TURNS}`);
  }
  return parsed;
}

export function runHermesProcess({ executable, args, timeoutMs, env, cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      cwd,
    });
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false; let pendingError; let forceKillTimer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      error ? reject(error) : resolve(value);
    };
    const requestStop = (error) => {
      if (settled || pendingError) return;
      pendingError = error;
      child.kill();
      forceKillTimer = setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, FORCE_KILL_DELAY_MS);
    };
    const timer = setTimeout(() => requestStop(new Error('Hermes one-shot timed out')), timeoutMs);
    const collect = (chunk, target) => {
      if (pendingError) return;
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { requestStop(new Error('Hermes output exceeded the limit')); return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
    child.on('error', (error) => finish(pendingError ?? error));
    child.on('close', async (code) => {
      if (pendingError) return finish(pendingError);
      if (code !== 0) {
        return finish(new Error(processFailure('Hermes', code, stderr)));
      }
      try { finish(undefined, parseHermesFindingsWithFunnel(stdout)); }
      catch (error) { finish(error); }
    });
  });
}

function processFailure(label, code, stderr) {
  const diagnostic = String(stderr ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\bsession_id:\s*[^\s,"']+/gi, 'session_id:<redacted-session>')
    .replace(/((?:authorization|[a-z0-9_-]*api[_-]?key|[a-z0-9_-]*token)\s*[:=]\s*)(?:bearer\s+)?[^\s,"']+/gi, '$1<redacted-secret>')
    .replace(/\b(?:sk|pk|ghp|gho|xox[abps])[-_][A-Za-z0-9._-]{8,}/gi, '<redacted-secret>')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '<redacted-secret>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<redacted-path>')
    .replace(/\/(?:home|Users)\/[^\s"']+/g, '<redacted-path>')
    .trim()
    .slice(0, 400);
  return `${label} exited with code ${code}${diagnostic ? `: ${diagnostic}` : ''}`;
}

async function readStdin() {
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_INPUT_BYTES) throw new Error('Adapter input exceeded the limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const payload = await readStdin();
    const result = await runHermesOneShot(payload);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500)}\n`);
    process.exitCode = 1;
  }
}
