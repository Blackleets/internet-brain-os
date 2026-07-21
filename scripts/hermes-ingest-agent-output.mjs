#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scanHermesSensitiveData } from './hermes-sensitive-data-scan.mjs';

const endpoint = process.env.IBOS_HERMES_INGEST_URL ?? 'http://127.0.0.1:4000/hermes/ingestions';
const secret = process.env.IBOS_HERMES_SECRET ?? process.env.HEPHAESTUS_HERMES_SECRET;
const args = process.argv.slice(2);
const nativeJsonl = args.includes('--native-jsonl');
const inputPath = args.find((arg) => arg !== '--native-jsonl');

if (!inputPath || inputPath === '--help' || inputPath === '-h') {
  console.error([
    'Usage:',
    '  IBOS_HERMES_SECRET=<secret> node scripts/hermes-ingest-agent-output.mjs <hermes-agent-output.json>',
    '  IBOS_HERMES_SECRET=<secret> node scripts/hermes-ingest-agent-output.mjs --native-jsonl <hermes-native-log.jsonl>',
  ].join('\n'));
  process.exit(inputPath ? 0 : 1);
}

if (!secret) {
  console.error('Missing IBOS_HERMES_SECRET or HEPHAESTUS_HERMES_SECRET.');
  process.exit(1);
}

const source = await readFile(resolve(inputPath), 'utf8');
const sensitiveFindings = scanHermesSensitiveData(source);
if (sensitiveFindings.length > 0) {
  console.error('Hermes ingestion blocked by sensitive-data preflight.');
  for (const finding of sensitiveFindings) console.error(`- ${finding.code} at line ${finding.line}`);
  console.error('Sanitize a copy of the capture and retry. No request was signed or sent.');
  process.exit(2);
}

let kernel;
try {
  kernel = await import('../packages/kernel/dist/index.js');
} catch (error) {
  console.error(`Kernel build is required first. Run pnpm build. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

let runOutput;
try {
  runOutput = nativeJsonl
    ? new kernel.HermesNativeLogExtractor().fromJsonl(source)
    : JSON.parse(source);
} catch (error) {
  console.error(`Invalid Hermes input: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const adapter = new kernel.HermesAgentOutputAdapter();
let events;
try {
  events = adapter.toExecutionEvents(runOutput);
} catch (error) {
  console.error(`Invalid Hermes Agent output: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const idempotencyKey = process.env.IBOS_HERMES_IDEMPOTENCY_KEY
  ?? runOutput.idempotencyKey
  ?? `hermes-agent-${runOutput.runId ?? Date.now()}`;
const recordId = process.env.IBOS_HERMES_RECORD_ID ?? `pipeline-${idempotencyKey}`;
const resultId = process.env.IBOS_HERMES_RESULT_ID ?? `result-${idempotencyKey}`;
const timestamp = new Date().toISOString();
const body = JSON.stringify({
  idempotencyKey,
  recordId,
  resultId,
  events,
  comparisons: Array.isArray(runOutput.comparisons) ? runOutput.comparisons : [],
});

const signature = createHmac('sha256', secret)
  .update(`${timestamp}.${idempotencyKey}.${body}`)
  .digest('hex');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-ibos-idempotency-key': idempotencyKey,
    'x-ibos-timestamp': timestamp,
    'x-ibos-signature': signature,
  },
  body,
});

const text = await response.text();
console.log(`${response.status} ${response.statusText}`);
console.log(text);

if (!response.ok) process.exit(1);
