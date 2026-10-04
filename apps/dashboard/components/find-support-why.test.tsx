// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FindsView } from './efesto-product-views';
import { kernelSupportProof } from '../lib/kernel/supported-find';
import type { MissionSummary, OpportunitySummary } from '../lib/kernel/contracts';

afterEach(cleanup);

// A Find card said "Kernel SUPPORT" but never why, nor which Kernel record proved it.
const find = (overrides: Partial<OpportunitySummary> = {}): OpportunitySummary => ({
  id: 'opp-1', title: 'Taladro 18V en oferta', category: 'offer', categoryLabel: 'Oferta', sourceHost: 'shop.example',
  sourceUrl: 'https://shop.example/taladro', evidenceId: 'ev-1', caseId: 'case-1', relevance: 0.8, status: 'opportunity',
  ...overrides,
} as OpportunitySummary);
const mission: MissionSummary = {
  id: 'mission-7', goalId: 'goal-1', status: 'completed', createdAt: '2026-09-28T09:00:00.000Z', executionPhase: 'forged',
  verificationResults: [{ candidateId: 'c1', status: 'verified', evidenceId: 'ev-1', supported: true, supportReason: 'supported' }],
} as MissionSummary;

describe('kernelSupportProof', () => {
  it('names the Kernel stamp or the verifying mission, and nothing otherwise', () => {
    expect(kernelSupportProof(find({ supported: true } as Partial<OpportunitySummary>), [])).toEqual({ kind: 'stamp' });
    expect(kernelSupportProof(find(), [mission])).toEqual({ kind: 'mission', missionId: 'mission-7' });
    expect(kernelSupportProof(find(), [])).toBeNull();
    const unsupported = { ...mission, verificationResults: [{ evidenceId: 'ev-1', supported: false, supportReason: 'insufficient_term_coverage' }] } as MissionSummary;
    expect(kernelSupportProof(find(), [unsupported])).toBeNull();
  });
});

describe('Find card explains Kernel SUPPORT', () => {
  it('says what the Kernel checked and which record proves it', () => {
    render(<FindsView opportunities={[find()]} missions={[mission]} connected onFeedback={vi.fn()} />);
    expect(screen.getByText('Por qué SUPPORT')).toBeTruthy();
    expect(screen.getByText(/El Kernel leyó la fuente y comprobó que cubre los términos clave del Goal/)).toBeTruthy();
    // the proving mission is a compact id chip (full id in its title)
    expect(screen.getByText(/verificación de la misión/)).toBeTruthy();
    expect(document.querySelector('.find-support-why .kernel-id-chip')?.getAttribute('title')).toBe('mission-7');
  });

  it('names the Kernel stamp when the Find itself carries it', () => {
    render(<FindsView opportunities={[find({ supported: true } as Partial<OpportunitySummary>)]} connected onFeedback={vi.fn()} />);
    expect(screen.getByText(/sello SUPPORT del Kernel en este hallazgo/)).toBeTruthy();
  });
});
