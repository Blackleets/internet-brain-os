import { describe, expect, it } from 'vitest';
import { applyLivingForgeActivity, forgeActivityForMission, livingForgeLiveLabel, temporaryForgeActivity } from './forge-activity.js';

const supported = {
  id: 'opp-drill',
  title: 'Taladro Bosch 21 EUR',
  evidenceId: 'ev-1',
  sourceUrl: 'https://shop.example/drill',
  supported: true,
};
const forgedMission = {
  status: 'completed',
  executionPhase: 'forged',
  resultSummary: { opportunitiesPromoted: 1 },
  verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: true }],
};

describe('pixel forge activity contract', () => {
  it('maps observable mission states to honest animation tones', () => {
    expect(forgeActivityForMission().tone).toBe('idle');
    expect(forgeActivityForMission({ status: 'waiting_for_agent' })).toMatchObject({ tone: 'error', label: 'Hermes not available' });
    expect(forgeActivityForMission({ status: 'queued' }).tone).toBe('queued');
    expect(forgeActivityForMission({ status: 'running' }).tone).toBe('working');
    expect(forgeActivityForMission({ status: 'running', executionPhase: 'verifying' }).tone).toBe('verifying');
    expect(forgeActivityForMission({ status: 'failed' }).tone).toBe('error');
  });

  it('reports Kernel-supported Find counts without inventing findings', () => {
    expect(forgeActivityForMission(forgedMission, [supported])).toMatchObject({
      tone: 'success', detail: '1 opportunity passed local checks and saved.',
    });
    expect(forgeActivityForMission({ status: 'completed', workState: 'forged', resultSummary: { opportunitiesPromoted: 0 } })).toMatchObject({
      tone: 'success', label: 'Research completed', detail: 'No strong opportunity passed the local checks.',
    });
  });

  it('does not treat opportunitiesPromoted or Evidence+URL as a Find without SUPPORT', () => {
    const unverified = { ...supported, supported: undefined };
    const mission = { ...forgedMission, verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: false }] };
    expect(forgeActivityForMission(mission, [unverified])).toMatchObject({
      tone: 'success', label: 'Research completed', detail: 'No strong opportunity passed the local checks.',
    });
    expect(forgeActivityForMission({ status: 'completed', executionPhase: 'forged', resultSummary: { opportunitiesPromoted: 3 } })).toMatchObject({
      tone: 'success', label: 'Research completed', detail: 'No strong opportunity passed the local checks.',
    });
  });

  it('does not present completed-without-forged as Forge complete', () => {
    const idle = forgeActivityForMission({ status: 'completed', resultSummary: { opportunitiesPromoted: 1 } });
    expect(idle.tone).toBe('idle');
    expect(idle.label).not.toMatch(/completado|forged|Forge complete|Research completed/i);
    expect(forgeActivityForMission({ status: 'completed' }).tone).toBe('idle');
  });

  it('uses explicit temporary states for manual capture', () => {
    expect(temporaryForgeActivity('capture').tone).toBe('working');
    expect(temporaryForgeActivity('capture-success')).toMatchObject({
      tone: 'success',
      label: 'Evidence preserved',
      detail: 'The page was preserved as private Evidence.',
    });
    expect(temporaryForgeActivity('capture-success').label).not.toMatch(/lead|Find|forged/i);
    expect(temporaryForgeActivity('capture-error').tone).toBe('error');
  });

  it('does not claim EN VIVO when Living Forge is idle without mission', () => {
    expect(livingForgeLiveLabel('idle')).toBe('LISTA');
    expect(livingForgeLiveLabel('success')).toBe('LISTA');
    expect(livingForgeLiveLabel('error')).toBe('ATENTA');
    expect(livingForgeLiveLabel('working')).toBe('EN VIVO');
    expect(livingForgeLiveLabel('verifying')).toBe('EN VIVO');
    expect(livingForgeLiveLabel('queued')).toBe('EN VIVO');
    expect(livingForgeLiveLabel('idle')).not.toMatch(/EN VIVO|LIVE/i);

    const el = {
      dataset: {},
      querySelector(selector) {
        return selector === '.live-badge-label' ? this.label : null;
      },
      label: { textContent: 'EN VIVO' },
    };
    applyLivingForgeActivity(el, 'idle');
    expect(el.dataset.activity).toBe('idle');
    expect(el.label.textContent).toBe('LISTA');
    applyLivingForgeActivity(el, 'working');
    expect(el.label.textContent).toBe('EN VIVO');
  });
});
