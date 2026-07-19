export interface WebPageDocument {
  readonly url: string;
  readonly title: string;
  readonly text: string;
  readonly fetchedAt: string;
  readonly contentType: string;
  readonly status: number;
}

export interface WebPageFetcherOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly fetchImpl?: typeof fetch;
  readonly lookupImpl?: typeof lookup;
}

/** Fetches public HTML pages and reduces them to clean, auditable text. */
export class WebPageFetcher {
  constructor(private readonly options: WebPageFetcherOptions = {}) {}

  async fetch(url: string): Promise<WebPageDocument> {
    let parsed = new URL(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);

    try {
      let response: Response | undefined;
      for (let redirects = 0; redirects <= 5; redirects += 1) {
        await assertPublicHttpUrl(parsed, this.options.lookupImpl ?? lookup);
        response = await (this.options.fetchImpl ?? fetch)(parsed, {
          redirect: 'manual', signal: controller.signal,
          headers: {
            accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
            'user-agent': this.options.userAgent ?? 'InternetBrainOS/0.1 (+public-research)',
          },
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect response is missing Location');
        if (redirects === 5) throw new Error('Too many redirects');
        parsed = new URL(location, parsed);
      }
      if (!response) throw new Error('Unable to fetch public page');

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      const body = await readBoundedText(response, 2 * 1024 * 1024);
      const title = extractTitle(body) || parsed.hostname;
      const text = contentType.includes('html') ? htmlToText(body) : body.trim();

      return {
        url: response.url || parsed.toString(),
        title,
        text,
        fetchedAt: new Date().toISOString(),
        contentType,
        status: response.status,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('Public page exceeds 2 MiB limit');
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
      throw new Error('Public page exceeds 2 MiB limit');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function assertPublicHttpUrl(url: URL, lookupImpl: typeof lookup): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only public HTTP(S) URLs without credentials are supported');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Private network URLs are not supported');
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookupImpl(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Private network URLs are not supported');
  }
}

function isPublicAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:')
    || normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : undefined);
  if (!ipv4) return isIP(normalized) === 6;
  const [a, b] = ipv4.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(stripTags(match[1])).replace(/\s+/g, ' ').trim() : '';
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
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
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
