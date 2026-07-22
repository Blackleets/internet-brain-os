#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export { scanHermesSensitiveData } from './hermes-sensitive-data-scan-core.mjs';
import { scanHermesSensitiveData } from './hermes-sensitive-data-scan-core.mjs';

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
