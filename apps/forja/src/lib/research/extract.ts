const AMP = "\u0026";

export function decodeEntities(text: string) {
  return text
    .replace(new RegExp(`${AMP}nbsp;`, "gi"), " ")
    .replaceAll(`${AMP}amp;`, AMP)
    .replaceAll(`${AMP}quot;`, '"')
    .replaceAll(`${AMP}#39;`, "'")
    .replaceAll(`${AMP}apos;`, "'")
    .replaceAll(`${AMP}lt;`, "<")
    .replaceAll(`${AMP}gt;`, ">");
}

export function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractReadableText(html: string) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");
  const main =
    cleaned.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ||
    cleaned.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ||
    cleaned.match(/id=["']mw-content-text["'][\s\S]{0,500000}/i)?.[0] ||
    cleaned;
  return stripHtml(main);
}

export function excerptOf(text: string, max = 8000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function titleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 180) : "";
}

export function unwrapDuckLink(href: string) {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && url.hostname) {
      return href;
    }
    return href;
  } catch {
    return href;
  }
}

export function isStructuredContentType(contentType: string) {
  const lower = contentType.toLowerCase();
  return (
    lower.includes("application/json") ||
    lower.includes("text/json") ||
    lower.includes("application/ld+json") ||
    lower.includes("text/csv") ||
    lower.includes("application/csv")
  );
}

export function formatStructuredDocument(input: {
  text: string;
  contentType: string;
  url: string;
  retrievedAt: string;
}): string {
  let body = input.text.trim();
  if (input.contentType.toLowerCase().includes("json")) {
    try {
      body = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      /* keep raw text; never invent a schema */
    }
  }
  return [
    "[structured]",
    `url: ${input.url}`,
    `retrievedAt: ${input.retrievedAt}`,
    `contentType: ${input.contentType}`,
    "limitations: El Kernel registra el documento recuperado. No infiere una serie, un pronóstico ni un hecho ausente.",
    "---",
    body,
  ].join("\n");
}

export async function readBounded(response: Response, maxBytes: number) {
  if (!response.body) {
    const text = await response.text();
    if (text.length <= maxBytes) return { text, bytes: text.length, truncated: false };
    return { text: text.slice(0, maxBytes), bytes: maxBytes, truncated: true };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (size + value.byteLength > maxBytes) {
      const room = maxBytes - size;
      if (room > 0) chunks.push(value.slice(0, room));
      size = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), bytes: size, truncated };
}
