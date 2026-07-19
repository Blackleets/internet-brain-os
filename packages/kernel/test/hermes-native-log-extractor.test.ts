import { describe, expect, it } from 'vitest';
import {
  HermesNativeLogExtractor,
  InvalidHermesAgentOutputError,
  InvalidHermesNativeLogError,
} from '../src';

const lines = [
  { type: 'run_started', runId: 'run-native-1', missionId: 'mission-native-1', taskId: 'task-native-1', at: '2026-07-20T00:00:00.000Z' },
  { type: 'evidence', id: 'evidence-native-1', requirementKey: 'source', verified: true, at: '2026-07-20T00:00:01.000Z' },
  { type: 'claim', id: 'proposal-native-1', statement: 'Native Hermes log produced a bounded evidence-backed claim.', confidence: 0.82, evidenceIds: ['evidence-native-1'], at: '2026-07-20T00:00:02.000Z' },
  { type: 'run_completed', summary: 'Native Hermes run completed.', at: '2026-07-20T00:00:03.000Z' },
];

describe('HermesNativeLogExtractor', () => {
  it('extracts bounded Hermes Agent output from JSONL native log entries', () => {
    const jsonl = lines.map((line) => JSON.stringify(line)).join('\n');

    expect(new HermesNativeLogExtractor().fromJsonl(jsonl)).toEqual({
      runId: 'run-native-1',
      missionId: 'mission-native-1',
      taskId: 'task-native-1',
      startedAt: '2026-07-20T00:00:00.000Z',
      completedAt: '2026-07-20T00:00:03.000Z',
      summary: 'Native Hermes run completed.',
      evidence: [{
        id: 'evidence-native-1',
        requirementKey: 'source',
        verified: true,
        recordedAt: '2026-07-20T00:00:01.000Z',
      }],
      claim: {
        id: 'proposal-native-1',
        statement: 'Native Hermes log produced a bounded evidence-backed claim.',
        confidence: 0.82,
        evidenceIds: ['evidence-native-1'],
        proposedAt: '2026-07-20T00:00:02.000Z',
      },
    });
  });

  it('rejects Kernel authority fields embedded in native logs', () => {
    const native = [
      ...lines.slice(0, 2),
      { ...lines[2], validation: { decision: 'accepted' } },
      lines[3],
    ];

    expect(() => new HermesNativeLogExtractor().fromEntries(native))
      .toThrow(InvalidHermesAgentOutputError);
  });

  it('rejects native claim references to unknown evidence', () => {
    const native = [
      lines[0],
      lines[1],
      { ...lines[2], evidenceIds: ['missing-evidence'] },
      lines[3],
    ];

    expect(() => new HermesNativeLogExtractor().fromEntries(native))
      .toThrow(InvalidHermesNativeLogError);
  });

  it('rejects invalid JSONL with line number', () => {
    expect(() => new HermesNativeLogExtractor().fromJsonl(`${JSON.stringify(lines[0])}\n{`))
      .toThrow('Invalid JSONL at line 2.');
  });
});
