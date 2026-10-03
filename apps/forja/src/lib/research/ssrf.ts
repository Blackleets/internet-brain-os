import { setDefaultResultOrder } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* Node without the API */
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateV4(ip: string) {
  const n = ipv4ToInt(ip);
  return (
    (n >= ipv4ToInt("10.0.0.0") && n <= ipv4ToInt("10.255.255.255")) ||
    (n >= ipv4ToInt("127.0.0.0") && n <= ipv4ToInt("127.255.255.255")) ||
    (n >= ipv4ToInt("169.254.0.0") && n <= ipv4ToInt("169.254.255.255")) ||
    (n >= ipv4ToInt("172.16.0.0") && n <= ipv4ToInt("172.31.255.255")) ||
    (n >= ipv4ToInt("192.168.0.0") && n <= ipv4ToInt("192.168.255.255")) ||
    (n >= ipv4ToInt("0.0.0.0") && n <= ipv4ToInt("0.255.255.255")) ||
    (n >= ipv4ToInt("100.64.0.0") && n <= ipv4ToInt("100.127.255.255"))
  );
}

function isPrivateV6(ip: string) {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("::ffff:")
  );
}

export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version === 6) return isPrivateV6(address);
  return true;
}

/** Shape and host gates only — no DNS. Used to reject unsafe redirect targets. */
export function rejectUnsafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL malformada.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Solo se permite HTTPS público.");
  }
  if (url.username || url.password) {
    throw new Error("Las URLs con credenciales están prohibidas.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Host no autorizado.");
  }
  if (isIP(host) && isPrivateAddress(host)) {
    throw new Error("Red privada rechazada.");
  }
  return url;
}

export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  const url = rejectUnsafeUrl(raw);
  await assertResolvedPublic(url);
  return url;
}

/**
 * Re-check DNS after connect. Residual TOCTOU remains between this lookup and
 * reading the body; we do not pin sockets to the resolved address.
 */
async function assertResolvedPublic(url: URL) {
  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) {
      throw new Error("Red privada rechazada.");
    }
    return;
  }
  const records = await lookup(url.hostname, { all: true });
  if (!records.length) throw new Error("No se pudo resolver el host.");
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error("Red privada rechazada.");
    }
  }
}

export async function nextPublicRedirect(current: URL, location: string | null): Promise<URL> {
  if (!location) throw new Error("Redirección sin destino.");
  const next = new URL(location, current);
  return assertPublicHttpsUrl(next.toString());
}

export async function fetchPublicHttps(
  start: URL,
  init: { headers: HeadersInit; timeoutMs: number },
): Promise<{ response: Response; url: string }> {
  let current = start;
  let hops = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs);
    try {
      const response = await fetch(current, {
        headers: init.headers,
        signal: controller.signal,
        redirect: "manual",
      });
      if (REDIRECT_STATUSES.has(response.status)) {
        hops += 1;
        if (hops > 3) throw new Error("Demasiados redireccionamientos.");
        if (response.body) await response.body.cancel();
        current = await nextPublicRedirect(current, response.headers.get("location"));
        continue;
      }
      await assertResolvedPublic(current);
      return { response, url: current.toString() };
    } catch (error) {
      if (error instanceof Error && /redireccion|HTTPS|privada|autorizado|malformada|credenciales|resolver/i.test(error.message) && error.message !== "fetch failed") {
        throw error;
      }
      throw Object.assign(new Error(describePublicFetchError(error)), {
        cause: error instanceof Error ? (error.cause ?? error) : error,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const FETCH_LIMIT_BYTES = 900_000;
export const FETCH_TIMEOUT_MS = 12_000;
/** Search APIs must finish well under Vercel Hobby's 10s function budget. */
export const SEARCH_ORIGIN_TIMEOUT_MS = 4_000;
export const SEARCH_AUX_TIMEOUT_MS = 2_500;

const OWN_SSRF_MESSAGE =
  /^(Solo se permite HTTPS|URL malformada|Las URLs con credenciales|Host no autorizado|Red privada rechazada|No se pudo resolver el host|Redirección sin destino|Demasiados redireccionamientos|La respuesta supera|Tiempo de |No se pudo contactar|El origen público|El certificado TLS)/;

function nestedCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === "object"; i += 1) {
    const node = current as { code?: string; cause?: unknown };
    if (typeof node.code === "string" && node.code) return node.code;
    current = node.cause;
  }
  return undefined;
}

export function describePublicFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo contactar el origen público.";
  if (OWN_SSRF_MESSAGE.test(error.message)) return error.message;
  const code = nestedCode(error);
  if (
    error.name === "AbortError" ||
    error.message === "This operation was aborted" ||
    code === "ABORT_ERR"
  ) {
    return "Tiempo de espera agotado al contactar el origen público.";
  }
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT" || code === "UND_ERR_HEADERS_TIMEOUT") {
    return "Tiempo de conexión agotado al origen público.";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "No se pudo resolver el DNS del origen público.";
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") {
    return "El origen público no es alcanzable desde este entorno.";
  }
  if (code === "CERT_HAS_EXPIRED" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return "El certificado TLS del origen público no es de confianza.";
  }
  if (error.message === "fetch failed") {
    return "No se pudo contactar el origen público.";
  }
  return error.message;
}
