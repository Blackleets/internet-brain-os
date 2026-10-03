// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MissionSummary } from '../../lib/kernel/contracts';
import type { GoalSurface } from '../../lib/kernel/goal-surfaces';
import { buildForgeModel } from '../../lib/forge/forge-model';
import { ForgeLiveView } from './forge-live-view';

// Kernel-shaped TEST FIXTURES (not product data).
const MISSION_ID = 'mission:view-test';
const surface = (workState: NonNullable<GoalSurface['mission']>['workState']): GoalSurface => ({
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-03T10:00:00.000Z',
  goal: { id: 'goal:1', title: 'Rust ownership guide', status: 'active', revision: 1, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  mission: { id: MISSION_ID, status: 'running', workState, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:01:00.000Z' },
});
const candidates = Array.from({ length: 8 }, (_, index) => ({
  id: `c${index}`, url: `https://site${index}.example/page`, title: `Hermes title ${index}`, snippet: `HERMES SNIPPET ${index}`, status: 'pending_verification',
}));
const row = (extra: Record<string, unknown> = {}) => ({ id: MISSION_ID, goalId: 'goal:1', goalTitle: 'Rust ownership guide', status: 'running', executionPhase: 'verifying', createdAt: '2026-10-03T09:00:00.000Z', searchCandidates: candidates, ...extra }) as MissionSummary;

afterEach(() => cleanup());

describe('ForgeLiveView', () => {
  it('renders an honest offline forge with a working connect action and no sources or numbers', () => {
    const onConnect = vi.fn();
    render(<ForgeLiveView model={buildForgeModel({ connected: false, kernelOnline: false })} onConnect={onConnect} />);
    expect(screen.getByRole('heading', { name: 'La forja está apagada' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: /Fuentes de la misión/ })).toBeNull();
    expect(screen.queryByLabelText('Contadores de la misión')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Conectar Kernel' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('shows a connecting state without claiming offline or offering a second connect action', () => {
    render(<ForgeLiveView model={buildForgeModel({ connected: true, connecting: true, kernelOnline: false })} onConnect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Encendiendo la forja…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Conectar Kernel' })).toBeNull();
  });

  it('lists real candidates while verifying, never quoting Hermes snippets, and reveals the rest on demand', () => {
    render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row() })} />);
    const list = screen.getByRole('list', { name: 'Fuentes de la misión (8)' });
    // jsdom has no layout width, so the narrow (mobile) limit of 6 applies.
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByText(/HERMES SNIPPET/)).toBeNull();
    expect(within(list).getAllByText('CANDIDATO')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Ver 2 fuentes más' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Mostrar menos fuentes' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Progreso de la misión' }).querySelector('[aria-current="step"]')?.textContent).toContain('Páginas leídas');
  });

  it('quotes only the Kernel Evidence excerpt for a SUPPORT source and offers the Find', () => {
    const onOpenFinds = vi.fn();
    const verificationResults = [
      { candidateId: 'c0', status: 'verified', evidenceId: 'e0', sourceUrl: candidates[0].url, supported: true, supportReason: 'supported' },
      { candidateId: 'c1', status: 'verified', evidenceId: 'e1', sourceUrl: candidates[1].url, supported: false, supportReason: 'insufficient_term_coverage' },
    ];
    const model = buildForgeModel({
      connected: true, kernelOnline: true, surface: surface('forged'), mission: row({ status: 'completed', executionPhase: 'forged', searchCandidates: candidates.slice(0, 2), verificationResults }),
      evidence: { status: 'available', records: [
        { id: 'e0', candidateId: 'c0', sourceUrl: candidates[0].url, title: 'Ownership', capturedAt: '2026-10-03T09:02:00.000Z', supported: true, supportReason: 'supported', excerpt: { text: 'Ownership is a set of rules.', anchor: 'goal_term', truncatedStart: false, truncatedEnd: false } },
        { id: 'e1', candidateId: 'c1', sourceUrl: candidates[1].url, title: 'Other page', capturedAt: '2026-10-03T09:02:01.000Z', supported: false, supportReason: 'insufficient_term_coverage', excerpt: null },
      ] },
      opportunities: [{ id: 'opp', title: 'Ownership', category: 'goal', categoryLabel: 'Goal match', benefitType: 'information', sourceHost: 'site0.example', relevance: 80, nextAction: 'Leer', status: 'new', detectedAt: '2026-10-03T09:02:00.000Z', evidenceId: 'e0', sourceUrl: candidates[0].url, supported: true }],
    });
    const { container } = render(<ForgeLiveView model={model} onOpenFinds={onOpenFinds} />);
    const supported = container.querySelector('.forge-source[data-state="supported"]') as HTMLElement;
    expect(within(supported).getByText('«Ownership is a set of rules.»')).toBeTruthy();
    expect(within(supported).getByText('KERNEL SUPPORT')).toBeTruthy();
    fireEvent.click(within(supported).getByRole('button', { name: 'Ver Find' }));
    expect(onOpenFinds).toHaveBeenCalledTimes(1);
    const unsupported = container.querySelector('.forge-source[data-state="unsupported"]') as HTMLElement;
    expect(within(unsupported).queryByRole('button', { name: 'Ver Find' })).toBeNull();
    expect(within(unsupported).getByText(/La página no cubre suficientes términos del Goal/)).toBeTruthy();
    expect(within(supported).getByRole('link', { name: /Abrir fuente/ }).getAttribute('href')).toBe(candidates[0].url);
    expect(screen.getByLabelText('Contadores de la misión').textContent).toContain('1');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBeTruthy();
  });
});
