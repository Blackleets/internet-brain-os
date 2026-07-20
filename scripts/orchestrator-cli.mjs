#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { OrchestratorStore } from './orchestrator-store.mjs';

const [command, ...args] = process.argv.slice(2);
const store = new OrchestratorStore(process.env.IBOS_ORCHESTRATOR_ROOT ?? '.orchestrator');

try {
  let result;
  if (command === 'status') result = await store.status();
  else if (command === 'create') result = await store.create(await input(args[0]));
  else if (command === 'activate') result = await store.activate(args[0]);
  else if (command === 'report') result = await store.report(args[0], await input(args[1]));
  else if (command === 'retry') result = await store.retry(args[0]);
  else if (command === 'approve') result = await store.approve(args[0], await input(args[1]), { founderApproved: args.includes('--founder-approved') });
  else if (command === 'reject') result = await store.reject(args[0], args.slice(1).join(' '));
  else if (command === 'inspect') result = await store.inspect(args[0]);
  else throw new Error('Usage: orchestrator <status|create|activate|report|retry|approve|reject|inspect>');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.code ?? 'ORCHESTRATOR_ERROR', message: error.message })}\n`);
  process.exitCode = 1;
}

async function input(path) {
  if (!path) throw new Error('A JSON input file is required.');
  return JSON.parse(await readFile(path, 'utf8'));
}
