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
  readonly requestImpl?: (url: URL, address: string, signal: AbortSignal, headers: Record<string, string>) => Promise<Response>;
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
        const address = await resolvePublicHttpUrl(parsed, this.options.lookupImpl ?? lookup);
        const headers: Record<string, string> = {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          'user-agent': this.options.userAgent ?? 'InternetBrainOS/0.1 (+public-research)',
        };
        // A request without Accept-Encoding means "any coding is acceptable" (RFC 9110),
        // so CDNs may answer gzip/br. The pinned request reads raw bytes: name exactly the
        // codings decodeContent() can undo. fetchImpl (undici) negotiates and decodes itself.
        if (!this.options.fetchImpl) headers['accept-encoding'] = 'gzip, deflate, br';
        response = this.options.fetchImpl
          ? await this.options.fetchImpl(parsed, { redirect: 'manual', signal: controller.signal, headers })
          : await (this.options.requestImpl ?? pinnedRequest)(parsed, address, controller.signal, headers);
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect response is missing Location');
        if (redirects === 5) throw new Error('Too many redirects');
        parsed = new URL(location, parsed);
      }
      if (!response) throw new Error('Unable to fetch public page');

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      // Raw transports (pinned request / requestImpl) hand back encoded bytes; fetchImpl
      // already decoded them while keeping the Content-Encoding header.
      const body = await readBoundedText(response, 2 * 1024 * 1024, !this.options.fetchImpl);
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

async function readBoundedText(response: Response, maximumBytes: number, decodeContentEncoding: boolean): Promise<string> {
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
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  const bytes = decodeContentEncoding
    ? decodeContent(raw, response.headers.get('content-encoding'), maximumBytes)
    : raw;
  return decodeText(bytes, response.headers.get('content-type'));
}

/** Undo Content-Encoding (gzip / x-gzip / deflate / br), bounded against decompression bombs. */
function decodeContent(bytes: Uint8Array, contentEncoding: string | null, maximumBytes: number): Uint8Array {
  const codings = (contentEncoding ?? '').split(',').map((item) => item.trim().toLowerCase()).filter((item) => item && item !== 'identity');
  let current = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Codings are listed in the order they were applied; undo them in reverse.
  for (const coding of codings.reverse()) {
    const options = { maxOutputLength: maximumBytes };
    try {
      if (coding === 'gzip' || coding === 'x-gzip') current = gunzipSync(current, options);
      else if (coding === 'br') current = brotliDecompressSync(current, options);
      else if (coding === 'deflate') {
        try { current = inflateSync(current, options); } catch (error) {
          if (error instanceof RangeError) throw error;
          current = inflateRawSync(current, options);
        }
      } else throw new Error(`Unsupported content-encoding: ${coding}`);
    } catch (error) {
      if (error instanceof RangeError) throw new Error('Public page exceeds 2 MiB limit');
      if (error instanceof Error && error.message.startsWith('Unsupported content-encoding')) throw error;
      throw new Error(`Undecodable ${coding} content`);
    }
  }
  return new Uint8Array(current.buffer, current.byteOffset, current.byteLength);
}

/**
 * Decode text in the declared charset and refuse binary bodies (images, PDFs, archives,
 * still-compressed bytes) so they never become Evidence.
 */
function decodeText(bytes: Uint8Array, contentType: string | null): string {
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) throw new Error('web.read returned binary or undecodable content');
  const charset = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? '')?.[1];
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(charset ?? 'utf-8'); } catch { decoder = new TextDecoder(); }
  const text = decoder.decode(bytes);
  let replaced = 0;
  for (const character of text) if (character === '\uFFFD') replaced += 1;
  if (text.length && replaced > 16 && replaced / text.length > 0.05) {
    throw new Error('web.read returned binary or undecodable content');
  }
  return text;
}

async function resolvePublicHttpUrl(url: URL, lookupImpl: typeof lookup): Promise<string> {
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
  return addresses[0].address;
}

function pinnedRequest(url: URL, address: string, signal: AbortSignal, headers: Record<string, string>): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)({
      protocol: url.protocol,
      hostname: address,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      family: isIP(address),
      servername: url.hostname,
      headers: { ...headers, host: url.host },
      signal,
    }, (incoming) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
        else if (value !== undefined) responseHeaders.set(name, value);
      }
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          incoming.destroy(new Error('Public page exceeds 2 MiB limit'));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: incoming.statusCode ?? 500,
        statusText: incoming.statusMessage,
        headers: responseHeaders,
      })));
      incoming.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

/**
 * Fail-close public-address gate for Kernel web.read.
 * WHATWG URL serializes IPv4-mapped hosts as ::ffff:7f00:1 (not ::ffff:127.0.0.1)
 * and IPv4-translated (SIIT) hosts as ::ffff:0:7f00:1 (not ::ffff:0:127.0.0.1).
 * NAT64 well-known prefix 64:ff9b::/96 (RFC 6052) embeds IPv4 the same way —
 * WHATWG serializes 64:ff9b::127.0.0.1 as 64:ff9b::7f00:1.
 * Deprecated IPv4-compatible (::/96, RFC 4291) embeds IPv4 without ::ffff: —
 * WHATWG serializes ::127.0.0.1 as ::7f00:1; DNS may also return 0:0:0:0:0:0:7f00:1.
 * Treat mapped, translated, NAT64, and compatible embeddings as the embedded IPv4 before private-range checks.
 */
function ipv4MappedFromAddress(address: string): string | undefined {
  // NAT64 well-known prefix 64:ff9b::/96 — last 32 bits are the embedded IPv4.
  const nat64Dotted = address.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
  if (nat64Dotted) return nat64Dotted[1];
  const nat64Hex = address.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (nat64Hex) {
    const hi = Number.parseInt(nat64Hex[1], 16);
    const lo = Number.parseInt(nat64Hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  const dotted = address.match(/^::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  // IPv4-mapped ::ffff:XXXX:YYYY and IPv4-translated ::ffff:0:XXXX:YYYY
  const hex = address.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  // Deprecated IPv4-compatible ::/96 (RFC 4291) — last 32 bits embed IPv4 without ::ffff:.
  const compatDotted = address.match(/^(?:0:0:0:0:0:0|:)?:(\d+\.\d+\.\d+\.\d+)$/);
  if (compatDotted) return compatDotted[1];
  const compatHex = address.match(/^(?:0:0:0:0:0:0|:)?:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!compatHex) return undefined;
  const hi = Number.parseInt(compatHex[1], 16);
  const lo = Number.parseInt(compatHex[2], 16);
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPublicAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:')
    || normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  const mapped = ipv4MappedFromAddress(normalized);
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : undefined);
  if (!ipv4) return isIP(normalized) === 6;
  const parts = ipv4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    // Special-purpose (IANA): 192.0.0.0/24 IETF protocol, 198.18.0.0/15 benchmarking.
    || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19)));
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

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  AMP: '&', LT: '<', GT: '>', QUOT: '"',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00B7', bull: '\u2022',
  lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201A', ldquo: '\u201C', rdquo: '\u201D', bdquo: '\u201E',
  laquo: '\u00AB', raquo: '\u00BB', lsaquo: '\u2039', rsaquo: '\u203A',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122', deg: '\u00B0', euro: '\u20AC', pound: '\u00A3',
  yen: '\u00A5', cent: '\u00A2', sect: '\u00A7', para: '\u00B6', times: '\u00D7', divide: '\u00F7',
  iexcl: '\u00A1', iquest: '\u00BF', ordf: '\u00AA', ordm: '\u00BA', shy: '\u00AD',
  aacute: '\u00E1', eacute: '\u00E9', iacute: '\u00ED', oacute: '\u00F3', uacute: '\u00FA',
  Aacute: '\u00C1', Eacute: '\u00C9', Iacute: '\u00CD', Oacute: '\u00D3', Uacute: '\u00DA',
  ntilde: '\u00F1', Ntilde: '\u00D1', uuml: '\u00FC', Uuml: '\u00DC', ouml: '\u00F6', Ouml: '\u00D6',
  auml: '\u00E4', Auml: '\u00C4', ccedil: '\u00E7', Ccedil: '\u00C7', agrave: '\u00E0', egrave: '\u00E8',
  szlig: '\u00DF', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', zwnj: '\u200C', zwj: '\u200D',
};

/** Single-pass HTML entity decoding (named, decimal, hex); "&amp;lt;" stays "&lt;". */
function decodeEntities(value: string): string {
  return value.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint === 0 || codePoint > 0x10FFFF
        || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) return '\uFFFD';
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[body] ?? entity;
  });
}
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateRawSync, inflateSync } from 'node:zlib';
