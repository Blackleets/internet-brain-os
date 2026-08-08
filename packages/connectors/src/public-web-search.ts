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
  readonly provider: 'duckduckgo-html';
  readonly results: readonly PublicWebSearchResult[];
}

export interface PublicWebSearchOptions {
  readonly timeoutMs?: number;
  readonly maxResults?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 12_000);
    try {
      const endpoint = new URL('https://html.duckduckgo.com/html/');
      endpoint.searchParams.set('q', normalizedQuery);
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
      const html = await readBoundedText(response, 1024 * 1024);
      return {
        query: normalizedQuery,
        searchedAt: (this.options.now ?? (() => new Date()))().toISOString(),
        provider: 'duckduckgo-html',
        results: parseDuckDuckGoHtml(html, limit),
      };
    } finally {
      clearTimeout(timeout);
    }
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

function normalizeResultUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  try {
    const candidate = value.startsWith('//') ? `https:${value}` : value;
    const parsed = new URL(candidate, 'https://duckduckgo.com');
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
      const unwrapped = parsed.searchParams.get('uddg');
      return unwrapped ? decodeURIComponent(unwrapped) : undefined;
    }
    return parsed.toString();
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
    .replace(/&#x27;/gi, "'");
}
