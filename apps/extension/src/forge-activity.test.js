import { describe, expect, it } from 'vitest';
import { forgeActivityForMission, temporaryForgeActivity } from './forge-activity.js';

describe('pixel forge activity contract', () => {
  it('maps observable mission states to honest animation tones', () => {
    expect(forgeActivityForMission().tone).toBe('idle');
    expect(forgeActivityForMission({ status: 'waiting_for_agent' })).toMatchObject({ tone: 'error', label: 'Hermes not available' });
    expect(forgeActivityForMission({ status: 'queued' }).tone).toBe('queued');
    expect(forgeActivityForMission({ status: 'running' }).tone).toBe('working');
    expect(forgeActivityForMission({ status: 'running', executionPhase: 'verifying' }).tone).toBe('verifying');
    expect(forgeActivityForMission({ status: 'failed' }).tone).toBe('error');
  });

  it('reports completed result counts without inventing findings', () => {
    expect(forgeActivityForMission({ status: 'completed', resultSummary: { opportunitiesPromoted: 1 } })).toMatchObject({
      tone: 'success', detail: '1 opportunity passed local checks and saved.',
    });
    expect(forgeActivityForMission({ status: 'completed', resultSummary: { opportunitiesPromoted: 0 } })).toMatchObject({
      tone: 'success', label: 'Research completed', detail: 'No strong opportunity passed the local checks.',
    });
  });

  it('uses explicit temporary states for manual capture', () => {
    expect(temporaryForgeActivity('capture').tone).toBe('working');
    expect(temporaryForgeActivity('capture-success').tone).toBe('success');
    expect(temporaryForgeActivity('capture-error').tone).toBe('error');
  });
});
