#!/usr/bin/env node
import { createHmac } from 'node:crypto';

const endpoint = process.env.IBOS_HERMES_INGEST_URL ?? 'http://127.0.0.1:4000/hermes/ingestions';
const secret = process.env.IBOS_HERMES_SECRET;

if (!secret) {
  console.error('Missing IBOS_HERMES_SECRET.');
  process.exit(1);
}

const timestamp = process.env.IBOS_HERMES_TIMESTAMP ?? new Date().toISOString();
const idempotencyKey = process.env.IBOS_HERMES_IDEMPOTENCY_KEY ?? `hermes-sample-${Date.now()}`;
const body = JSON.stringify({
  idempotencyKey,
  recordId: process.env.IBOS_HERMES_RECORD_ID ?? `pipeline-${idempotencyKey}`,
  resultId: process.env.IBOS_HERMES_RESULT_ID ?? `result-${idempotencyKey}`,
  events: [
    {
      type: 'run_started',
      missionId: 'mission-hermes-sample',
      taskId: 'task-hermes-sample',
      at: timestamp,
    },
    {
      type: 'evidence_recorded',
      evidenceId: 'evidence-hermes-sample-1',
      requirementKey: 'source',
      verified: true,
      at: timestamp,
    },
    {
      type: 'claim_proposed',
      proposalId: 'proposal-hermes-sample-1',
      statement: 'Hermes sample execution reached the signed local Internet Brain OS ingestion boundary.',
      confidence: 0.9,
      evidenceIds: ['evidence-hermes-sample-1'],
      at: timestamp,
    },
    {
      type: 'run_completed',
      summary: 'Hermes sample execution completed.',
      at: timestamp,
    },
  ],
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
