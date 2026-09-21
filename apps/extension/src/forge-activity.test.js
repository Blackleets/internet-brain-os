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

    it('keeps zero-SUPPORT forged Living Forge off success celebrate chrome', () => {
    // Central Forge orb research_completed → idle; popup #living-forge must not paint
    // data-activity=success (green badge + celebrate) for Research completed.
    const zero = forgeActivityForMission({
      status: 'completed',
      executionPhase: 'forged',
      verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: false }],
    });
    expect(zero).toMatchObject({ tone: 'idle', label: 'Research completed' });
    expect(zero.tone).not.toBe('success');
  });

it('reports Kernel-supported Find counts without inventing findings', () => {
    const supportedAviso = forgeActivityForMission(forgedMission, [supported]);
    expect(supportedAviso).toMatchObject({
      tone: 'success',
      label: 'A Kernel SUPPORT Find was forged',
      detail: '1 Find passed Kernel SUPPORT and were forged.',
    });
    expect(supportedAviso.label).not.toMatch(/useful lead|opportunit/i);
    expect(forgeActivityForMission({ status: 'completed', workState: 'forged', resultSummary: { opportunitiesPromoted: 0 } })).toMatchObject({
      tone: 'idle', label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.',
    });
  });


  it('uses mission verificationResults SUPPORT when inbox is empty or understates', () => {
    // listOpportunities catch→[] must not demote Living Forge below Kernel SUPPORT proof.
    expect(forgeActivityForMission(forgedMission, [])).toMatchObject({
      tone: 'success',
      label: 'A Kernel SUPPORT Find was forged',
      detail: '1 Find passed Kernel SUPPORT and were forged.',
    });
    const twoSupport = {
      ...forgedMission,
      verificationResults: [
        { candidateId: 'cand-1', evidenceId: 'ev-1', supported: true },
        { candidateId: 'cand-2', evidenceId: 'ev-2', supported: true },
      ],
    };
    // Partial opportunities page understates vs Living Forge verificationResults.
    expect(forgeActivityForMission(twoSupport, [supported])).toMatchObject({
      tone: 'success',
      label: 'Kernel SUPPORT Finds were forged',
      detail: '2 Finds passed Kernel SUPPORT and were forged.',
    });
  });

  it('does not treat opportunitiesPromoted or Evidence+URL as a Find without SUPPORT', () => {
    const unverified = { ...supported, supported: undefined };
    const mission = { ...forgedMission, verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: false }] };
    expect(forgeActivityForMission(mission, [unverified])).toMatchObject({
      tone: 'idle', label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.',
    });
    expect(forgeActivityForMission({ status: 'completed', executionPhase: 'forged', resultSummary: { opportunitiesPromoted: 3 } })).toMatchObject({
      tone: 'idle', label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.',
    });
  });

  it('names Research ended without Evidence for bare completed — never forge-is-ready Forja lista', () => {
    // Home forge-state-action / #mission-state already say Terminada sin Evidence /
    // Research ended without Evidence; Living Forge must not keep "The forge is ready".
    const ended = forgeActivityForMission({ status: 'completed', resultSummary: { opportunitiesPromoted: 1 } });
    expect(ended).toMatchObject({
      tone: 'idle',
      label: 'Research ended without Evidence',
      detail: 'The bounded attempt finished. No Kernel-sealed Evidence was forged.',
    });
    expect(ended.label).not.toMatch(/forge is ready|completado|forged|Forge complete|Research completed|Find SUPPORT/i);
    expect(ended.tone).not.toBe('success');
    expect(forgeActivityForMission({ status: 'completed' }).label).toBe('Research ended without Evidence');
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
