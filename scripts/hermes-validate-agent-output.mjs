#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const nativeJsonl = args.includes('--native-jsonl');
const json = args.includes('--json');
const inputPath = args.find((arg) => arg !== '--native-jsonl' && arg !== '--json');

if (!inputPath || inputPath === '--help' || inputPath === '-h') {
  console.error([
    'Usage:',
    '  node scripts/hermes-validate-agent-output.mjs <hermes-agent-output.json>',
    '  node scripts/hermes-validate-agent-output.mjs --native-jsonl <hermes-native-log.jsonl>',
    '  node scripts/hermes-validate-agent-output.mjs --json <hermes-agent-output.json>',
    '  node scripts/hermes-validate-agent-output.mjs --json --native-jsonl <hermes-native-log.jsonl>',
  ].join('\n'));
  process.exit(inputPath ? 0 : 1);
}

let kernel;
try {
  kernel = await import('../packages/kernel/dist/index.js');
} catch (error) {
  console.error(`Kernel build is required first. Run pnpm build. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const source = await readFile(resolve(inputPath), 'utf8');
let runOutput;
try {
  runOutput = nativeJsonl
    ? new kernel.HermesNativeLogExtractor().fromJsonl(source)
    : JSON.parse(source);
} catch (error) {
  fail('Invalid Hermes input', error);
}

const adapter = new kernel.HermesAgentOutputAdapter();
let events;
try {
  events = adapter.toExecutionEvents(runOutput);
} catch (error) {
  fail('Invalid Hermes Agent output', error);
}

const summary = {
  ok: true,
  mode: nativeJsonl ? 'native-jsonl' : 'bounded-json',
  runId: runOutput.runId,
  missionId: runOutput.missionId,
  taskId: runOutput.taskId,
  evidenceCount: Array.isArray(runOutput.evidence) ? runOutput.evidence.length : 0,
  claimId: runOutput.claim?.id,
  eventCount: events.length,
  eventTypes: events.map((event) => event.type),
};

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log('Hermes Agent output validation PASS');
  console.log(JSON.stringify(summary, null, 2));
}

function fail(label, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.error(JSON.stringify({ ok: false, error: label, message }, null, 2));
  } else {
    console.error(`${label}: ${message}`);
  }
  process.exit(1);
}
