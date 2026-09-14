const SENSITIVE_PATTERNS = [
  ['PRIVATE_KEY', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gu],
  ['AUTH_BEARER', /\bauthorization\s*[:=]\s*["']?bearer\s+[A-Za-z0-9._~+/=-]{12,}/giu],
  ['COOKIE_HEADER', /\b(?:set-cookie|cookie)\s*:\s*[^\r\n]{8,}/giu],
  // Kernel auth header used by extension/dashboard/Hermes workers (ingest must not admit it).
  ['HEPHAESTUS_TOKEN_HEADER', /\bx-hephaestus-token\s*[:=]\s*["']?[^\s,"']{8,}/giu],
  // Include Kernel/extension credential field names (apiToken, kernelApiToken, x-hephaestus-token)
  // and env secret names when serialized as JSON — env NAME=value alone is not enough.
  ['SENSITIVE_JSON_FIELD', /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|api[_-]?token|kernel[_-]?api[_-]?token|x-hephaestus-token|IBOS_HERMES_SECRET|HEPHAESTUS_HERMES_SECRET|HEPHAESTUS_API_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|secret|password|authorization|cookie)"\s*:\s*"[^"]+"/giu],
  ['SENSITIVE_ENV_VALUE', /\b(?:IBOS_HERMES_SECRET|HEPHAESTUS_HERMES_SECRET|HEPHAESTUS_API_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN)\s*=\s*["']?[^\s"']+/giu],
  ['URL_CREDENTIALS', /https?:\/\/[^/\s:@]+:[^/\s@]+@/giu],
];

export function scanHermesSensitiveData(input) {
  const text = String(input);
  const findings = [];

  for (const [code, pattern] of SENSITIVE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      findings.push({
        code,
        line: 1 + text.slice(0, match.index).split('\n').length - 1,
      });
    }
  }

  return findings.sort((left, right) => left.line - right.line || left.code.localeCompare(right.code));
}
