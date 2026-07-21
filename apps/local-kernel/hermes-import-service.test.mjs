import { describe, expect, it } from 'vitest';
import { HermesImportError, HermesReplayLabImportService } from './hermes-import-service.mjs';

const output = {
  runId: 'run-real-1', missionId: 'mission-1', taskId: 'task-1',
  startedAt: '2026-07-22T10:00:00.000Z', completedAt: '2026-07-22T10:00:01.000Z', summary: 'Done',
  evidence: [{ id: 'evidence-1', requirementKey: 'source', verified: true, recordedAt: '2026-07-22T10:00:00.500Z' }],
  claim: { id: 'proposal-1', statement: 'Observed claim', confidence: 0.8, evidenceIds: ['evidence-1'], proposedAt: '2026-07-22T10:00:00.750Z' },
};

class Adapter { toExecutionEvents(value) { if (value.validation) throw new Error('authority field forbidden'); return [{ type: 'run_started' }, { type: 'run_completed' }]; } }
class Extractor { fromJsonl() { return output; } }
const kernel = { HermesAgentOutputAdapter: Adapter, HermesNativeLogExtractor: Extractor };

function service(route = { handle: async () => ({ status: 202, body: { recordId: 'pipeline-hermes-agent-run-real-1' } }) }) {
  return new HermesReplayLabImportService({ kernel, route, secret: 'test-boundary-secret', now: () => new Date('2026-07-22T11:00:00.000Z') });
}

describe('Replay Lab Hermes import service', () => {
  it('validates JSON without contacting ingestion', () => {
    const result = service({ handle: () => { throw new Error('must not ingest'); } }).validate({ format: 'json', content: JSON.stringify(output) });
    expect(result).toMatchObject({ idempotencyKey: 'hermes-agent-run-real-1', recordId: 'pipeline-hermes-agent-run-real-1' });
    expect(result.events).toHaveLength(2);
  });

  it('blocks sensitive data without returning the matched value', () => {
    const secret = 'sk-this-value-must-not-be-returned';
    expect(() => service().validate({ format: 'json', content: JSON.stringify({ ...output, api_key: secret }) }))
      .toThrow(expect.objectContaining({ code: 'SENSITIVE_DATA_DETECTED', status: 422 }));
    try { service().validate({ format: 'json', content: JSON.stringify({ ...output, api_key: secret }) }); }
    catch (error) { expect(JSON.stringify(error)).not.toContain(secret); }
  });

  it('rejects Kernel authority fields before ingestion', () => {
    expect(() => service().validate({ format: 'json', content: JSON.stringify({ ...output, validation: { decision: 'accepted' } }) }))
      .toThrow(expect.objectContaining({ code: 'INVALID_HERMES_CAPTURE' }));
  });

  it('signs and forwards a validated capture through the existing route', async () => {
    let request;
    const result = await service({ handle: async (value) => { request = value; return { status: 202, body: { recordId: 'pipeline-hermes-agent-run-real-1' } }; } })
      .ingest({ format: 'json', content: JSON.stringify(output) });
    expect(result.recordId).toBe('pipeline-hermes-agent-run-real-1');
    expect(request.headers['x-ibos-signature']).toMatch(/^[a-f0-9]{64}$/u);
    expect(request.remoteAddress).toBe('127.0.0.1');
  });
});
