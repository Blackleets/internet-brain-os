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
}

/** Fetches public HTML pages and reduces them to clean, auditable text. */
export class WebPageFetcher {
  constructor(private readonly options: WebPageFetcherOptions = {}) {}

  async fetch(url: string): Promise<WebPageDocument> {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);

    try {
      const response = await fetch(parsed, {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          'user-agent': this.options.userAgent ?? 'InternetBrainOS/0.1 (+public-research)',
        },
      });

      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      const body = await response.text();
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
