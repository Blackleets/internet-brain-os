#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SENSITIVE_PATTERNS = [
  ['PRIVATE_KEY', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gu],
  ['AUTH_BEARER', /\bauthorization\s*[:=]\s*["']?bearer\s+[A-Za-z0-9._~+/=-]{12,}/giu],
  ['COOKIE_HEADER', /\b(?:set-cookie|cookie)\s*:\s*[^\r\n]{8,}/giu],
  ['SENSITIVE_JSON_FIELD', /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|authorization|cookie)"\s*:\s*"[^"]+"/giu],
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

export async function runSensitiveDataPreflight(inputPath) {
  const source = await readFile(resolve(inputPath), 'utf8');
  return scanHermesSensitiveData(source);
}

async function main(args) {
  const inputPath = args.find((arg) => arg !== '--help' && arg !== '-h');
  if (!inputPath || args.includes('--help') || args.includes('-h')) {
    console.error('Usage: node scripts/hermes-sensitive-data-scan.mjs <sanitized-hermes-output.json|jsonl|log>');
    return inputPath ? 0 : 1;
  }

  const findings = await runSensitiveDataPreflight(inputPath);
  if (findings.length > 0) {
    console.error('Hermes sensitive-data preflight FAILED.');
    for (const finding of findings) console.error(`- ${finding.code} at line ${finding.line}`);
    console.error('Remove or replace sensitive values in a copy of the capture, then run the preflight again.');
    return 2;
  }

  console.log('Hermes sensitive-data preflight PASS');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    console.error(`Unable to scan Hermes output: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
