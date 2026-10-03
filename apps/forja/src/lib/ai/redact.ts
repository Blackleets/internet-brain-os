const KEYISH = /(?:sk-|or-|xai-|AIza)[A-Za-z0-9_\-]{12,}|Bearer\s+[A-Za-z0-9_\-\.]+/gi;

export function collectSecrets(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.length >= 8) out.push(trimmed);
  }
  return [...new Set(out)];
}

export function redactSecrets(value: string, secrets: string[] = []): string {
  let out = value;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out.replace(KEYISH, "[redacted]");
}

export function looksLikeSecret(value: string): boolean {
  KEYISH.lastIndex = 0;
  const hit = KEYISH.test(value);
  KEYISH.lastIndex = 0;
  return hit;
}

export function assertNoSecrets(value: string, secrets: string[] = []): boolean {
  const redacted = redactSecrets(value, secrets);
  if (redacted !== value) return false;
  for (const secret of secrets) {
    if (secret && value.includes(secret)) return false;
  }
  return true;
}
