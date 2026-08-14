export interface PublicWebSearchResult {
  readonly rank: number;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly sourceHost: string;
}

export interface PublicWebSearchResponse {
  readonly query: string;
  readonly searchedAt: string;
  readonly provider: 'duckduckgo-html' | 'brave-html' | 'bing-html';
  readonly results: readonly PublicWebSearchResult[];
}

export interface PublicWebSearchOptions {
  readonly timeoutMs?: number;
  readonly maxResults?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly market?: string;
  readonly language?: string;
}

/**
 * Credential-free native discovery provider for public-web research.
 * The provider endpoint is fixed; user input is encoded only as a search query.
 */
export class PublicWebSearchClient {
  constructor(private readonly options: PublicWebSearchOptions = {}) {}

  async search(query: string, requestedLimit?: number): Promise<PublicWebSearchResponse> {
    const normalizedQuery = normalizeQuery(query);
    const limit = normalizeLimit(requestedLimit ?? this.options.maxResults ?? 10);
    let lastProviderError: unknown;
    const duckDuckGoProviders = [
      { endpoint: 'https://html.duckduckgo.com/html/', parse: parseDuckDuckGoHtml },
      { endpoint: 'https://lite.duckduckgo.com/lite/', parse: parseDuckDuckGoLiteHtml },
    ] as const;
    for (const provider of duckDuckGoProviders) {
      try {
        const endpoint = new URL(provider.endpoint);
        endpoint.searchParams.set('q', normalizedQuery);
        const html = await this.fetchHtml(endpoint);
        const results = filterRelevantResults(normalizedQuery, provider.parse(html, limit));
        if (results.length > 0) return this.response(normalizedQuery, 'duckduckgo-html', results);
      } catch (error) {
        lastProviderError = error;
      }
    }

    try {
      const endpoint = new URL('https://search.brave.com/search');
      endpoint.searchParams.set('q', normalizedQuery);
      endpoint.searchParams.set('source', 'web');
      const html = await this.fetchHtml(endpoint);
      const results = filterRelevantResults(normalizedQuery, parseBraveHtml(html, limit));
      if (results.length > 0) return this.response(normalizedQuery, 'brave-html', results);
    } catch (error) {
      lastProviderError = error;
    }

    try {
      const endpoint = new URL('https://www.bing.com/search');
      endpoint.searchParams.set('q', normalizedQuery);
      endpoint.searchParams.set('count', String(limit));
      endpoint.searchParams.set('cc', this.options.market ?? 'es');
      endpoint.searchParams.set('setlang', this.options.language ?? 'es');
      const html = await this.fetchHtml(endpoint);
      return this.response(normalizedQuery, 'bing-html', filterRelevantResults(normalizedQuery, parseBingHtml(html, limit)));
    } catch (error) {
      throw error ?? lastProviderError ?? new Error('Public search provider unavailable');
    }
  }

  private async fetchHtml(endpoint: string | URL): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 12_000);
    try {
      const response = await (this.options.fetchImpl ?? fetch)(endpoint, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'InternetBrainOS/0.1 (+public-search)',
        },
      });
      if (!response.ok) throw new Error(`Public search provider returned HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('html')) throw new Error('Public search provider returned a non-HTML response');
      return readBoundedText(response, 1024 * 1024);
    } finally {
      clearTimeout(timeout);
    }
  }

  private response(query: string, provider: PublicWebSearchResponse['provider'], results: readonly PublicWebSearchResult[]): PublicWebSearchResponse {
    return {
      query,
      searchedAt: (this.options.now ?? (() => new Date()))().toISOString(),
      provider,
      results,
    };
  }
}

export function parseDuckDuckGoHtml(html: string, limit = 10): readonly PublicWebSearchResult[] {
  const resultPattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>|<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi;
  const results: PublicWebSearchResult[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && results.length < normalizeLimit(limit)) {
    const target = normalizeResultUrl(decodeEntities(match[1] ?? ''));
    if (!target || seen.has(target)) continue;
    let parsed: URL;
    try { parsed = new URL(target); } catch { continue; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
    const title = cleanText(match[2] ?? '');
    if (!title) continue;
    seen.add(target);
    results.push({
      rank: results.length + 1,
      title,
      url: parsed.toString(),
      snippet: cleanText(match[3] ?? '').slice(0, 500),
      sourceHost: parsed.hostname.toLowerCase(),
    });
  }
  return results;
}

export function parseDuckDuckGoLiteHtml(html: string, limit = 10): readonly PublicWebSearchResult[] {
  const anchorPattern = /<a\b[^>]*class=["'][^"']*\bresult-link\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: PublicWebSearchResult[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) && results.length < normalizeLimit(limit)) {
    const tagStart = html.lastIndexOf('<a', match.index);
    const tagEnd = html.indexOf('>', tagStart);
    if (tagStart < 0 || tagEnd < 0) continue;
    const tag = html.slice(tagStart, tagEnd + 1);
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    if (!href.includes('uddg=')) continue;
    const target = normalizeResultUrl(decodeEntities(href));
    if (!target || seen.has(target)) continue;
    let parsed: URL;
    try { parsed = new URL(target); } catch { continue; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
    const title = cleanText(match[1] ?? '');
    if (!title) continue;
    const following = html.slice(anchorPattern.lastIndex, anchorPattern.lastIndex + 5000);
    const snippet = /<(?:td|div)\b[^>]*class=["'][^"']*\bresult-snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:td|div)>/i.exec(following)?.[1] ?? '';
    seen.add(target);
    results.push({
      rank: results.length + 1,
      title,
      url: parsed.toString(),
      snippet: cleanText(snippet).slice(0, 500),
      sourceHost: parsed.hostname.toLowerCase(),
    });
  }
  return results;
}

export function parseBraveHtml(html: string, limit = 10): readonly PublicWebSearchResult[] {
  const resultPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*[\s\S]*?<div[^>]+class=["'][^"']*\btitle\b[^"']*\bsearch-snippet-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/a>/gi;
  const results: PublicWebSearchResult[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && results.length < normalizeLimit(limit)) {
    const target = normalizeResultUrl(decodeEntities(match[1] ?? ''));
    if (!target || seen.has(target)) continue;
    let parsed: URL;
    try { parsed = new URL(target); } catch { continue; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
    const title = cleanText(match[2] ?? '');
    if (!title) continue;
    const following = html.slice(resultPattern.lastIndex, resultPattern.lastIndex + 4000);
    const snippet = /<div[^>]+class=["'][^"']*\bgeneric-snippet\b[^"']*["'][^>]*>[\s\S]*?<div[^>]+class=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(following)?.[1] ?? '';
    seen.add(target);
    results.push({
      rank: results.length + 1,
      title,
      url: parsed.toString(),
      snippet: cleanText(snippet).slice(0, 500),
      sourceHost: parsed.hostname.toLowerCase(),
    });
  }
  return results;
}

export function parseBingHtml(html: string, limit = 10): readonly PublicWebSearchResult[] {
  const resultPattern = /<li[^>]+class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  const results: PublicWebSearchResult[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) && results.length < normalizeLimit(limit)) {
    const block = match[1] ?? '';
    const link = /<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!link) continue;
    const target = normalizeBingResultUrl(decodeEntities(link[1] ?? ''));
    if (!target || seen.has(target)) continue;
    let parsed: URL;
    try { parsed = new URL(target); } catch { continue; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
    const title = cleanText(link[2] ?? '');
    if (!title) continue;
    const snippetMatch = /<div[^>]+class=["'][^"']*\bb_caption\b[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    seen.add(target);
    results.push({
      rank: results.length + 1,
      title,
      url: parsed.toString(),
      snippet: cleanText(snippetMatch?.[1] ?? '').slice(0, 500),
      sourceHost: parsed.hostname.toLowerCase(),
    });
  }
  return results;
}

function normalizeResultUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  try {
    const candidate = value.startsWith('//') ? `https:${value}` : value;
    const parsed = new URL(candidate, 'https://duckduckgo.com');
    if (isProviderHost(parsed.hostname, 'duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
      const unwrapped = parsed.searchParams.get('uddg');
      return unwrapped ? normalizeResultUrl(decodeURIComponent(unwrapped)) : undefined;
    }
    if (isProviderHost(parsed.hostname, 'duckduckgo.com')) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function normalizeBingResultUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  try {
    const parsed = new URL(value, 'https://www.bing.com');
    if (isProviderHost(parsed.hostname, 'bing.com') && parsed.pathname.startsWith('/ck/')) {
      const encoded = parsed.searchParams.get('u');
      const decoded = encoded ? decodeBingRedirect(encoded) : undefined;
      return decoded ? normalizeResultUrl(decoded) : undefined;
    }
    if (isProviderHost(parsed.hostname, 'bing.com')) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function decodeBingRedirect(value: string): string | undefined {
  const encoded = value.startsWith('a1') ? value.slice(2) : value;
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

function normalizeQuery(value: string): string {
  if (typeof value !== 'string') throw new Error('Search query must be a string');
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 300 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('Search query is invalid');
  }
  return normalized;
}

const SEARCH_STOP_WORDS = new Set([
  'a', 'al', 'an', 'and', 'busca', 'by', 'con', 'de', 'del', 'el', 'en', 'find', 'for', 'from', 'give', 'la', 'las', 'los', 'me', 'my', 'of', 'para', 'por', 'que', 'the', 'to', 'un', 'una', 'with', 'y',
]);

function filterRelevantResults(query: string, results: readonly PublicWebSearchResult[]): readonly PublicWebSearchResult[] {
  const queryTokens = tokenizeSearchText(query).filter((token) => !SEARCH_STOP_WORDS.has(token));
  if (queryTokens.length === 0) return results;
  return results
    .filter((result) => {
      const resultTokens = new Set(tokenizeSearchText(`${result.title} ${result.snippet} ${result.sourceHost}`));
      return queryTokens.some((token) => resultTokens.has(token));
    })
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

function tokenizeSearchText(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function isProviderHost(hostname: string, provider: string): boolean {
  return hostname === provider || hostname.endsWith(`.${provider}`);
}

function normalizeLimit(value: number): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return 10;
  return Math.min(numeric, 20);
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('Public search response exceeds 1 MiB limit');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new Error('Public search response exceeds 1 MiB limit');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
