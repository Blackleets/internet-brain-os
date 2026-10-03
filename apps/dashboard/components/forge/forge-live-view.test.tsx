// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MissionSummary } from '../../lib/kernel/contracts';
import type { GoalSurface } from '../../lib/kernel/goal-surfaces';
import { buildForgeModel } from '../../lib/forge/forge-model';
import { act } from 'react';
import { clipQuote, ForgeLiveView, formatAgo } from './forge-live-view';

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
    expect(supported.querySelector('blockquote')?.textContent).toBe('«Ownership is a set of rules.»');
    // The Goal term in the Kernel excerpt is marked.
    expect([...supported.querySelectorAll('mark.forge-term')].map((mark) => mark.textContent)).toEqual(['Ownership']);
    expect(within(supported).getByText('KERNEL SUPPORT')).toBeTruthy();
    // The Find title opens the Find.
    fireEvent.click(within(supported).getByRole('button', { name: /^Ownership\s*· ver Find$/ }));
    expect(onOpenFinds).toHaveBeenCalledTimes(1);
    const unsupported = container.querySelector('.forge-source[data-state="unsupported"]') as HTMLElement;
    expect(within(unsupported).queryByRole('button', { name: /ver Find/ })).toBeNull();
    expect(within(unsupported).getByText('EVIDENCE', { selector: '.forge-badge-final' })).toBeTruthy();
    expect(within(unsupported).getByText(/no cubre suficientes términos del Goal/i)).toBeTruthy();
    // Steel cards show only their reason, never a quote.
    expect(unsupported.querySelector('blockquote')).toBeNull();
    expect(within(supported).getByRole('link', { name: /Abrir fuente/ }).getAttribute('href')).toBe(candidates[0].url);
    expect(screen.getByLabelText('Contadores de la misión').textContent).toContain('1');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBeTruthy();
  });

  it('keeps a queued mission alive but honest: waiting copy, next step, no sources and no search claim', () => {
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued'), mission: row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined }) })} />);
    const bench = container.querySelector('.forge-bench') as HTMLElement;
    expect(bench.dataset.mode).toBe('waiting');
    expect(within(bench).getByText('Esperando turno del agente')).toBeTruthy();
    expect(screen.getAllByText(/esperando turno del agente/i)).toHaveLength(1);
    expect(within(bench).getByText(/Siguiente: Hermes toma la misión/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: /Fuentes de la misión/ })).toBeNull();
    expect(container.querySelector('.forge-bench-query')).toBeNull();
  });

  it('shows the Goal the agent searches from while investigating and says the exact query is not published', () => {
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined, scope: { keywords: ['rust', 'ownership'] } }) })} />);
    const bench = container.querySelector('.forge-bench') as HTMLElement;
    expect(bench.dataset.mode).toBe('searching');
    expect(bench.querySelector('.forge-bench-q')?.textContent).toBe('«Rust ownership guide»');
    expect(within(bench).getByText('desde el Goal')).toBeTruthy();
    expect(container.querySelector('.forge-bench-meta')?.textContent).toMatch(/la consulta exacta no la publica el Kernel/);
  });

  it('shows the real queries and "N resultados devueltos" only when the Kernel recorded search telemetry', () => {
    const searchTelemetry = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-10-03T09:01:00.000Z', searches: [
      { query: 'rust ownership rules', limit: 10, resultCount: 10 },
      { query: 'rust borrow checker guide', limit: 10, resultCount: 9 },
    ] };
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchTelemetry }) })} />);
    // The chip settles on the last query typed; every query is in the title and for screen readers.
    expect(container.querySelector('.forge-bench-q')?.textContent).toBe('«rust borrow checker guide»');
    expect(container.querySelector('.forge-chip')?.getAttribute('title')).toContain('«rust ownership rules» · «rust borrow checker guide»');
    expect(container.querySelector('.forge-chip-tag')?.textContent).toBe('2 consultas');
    const results = container.querySelector('.forge-live-counters [data-k="results"]') as HTMLElement;
    expect(results.textContent).toBe('resultados devueltos19');
    expect(container.querySelector('.forge-bench-meta')?.textContent).toBe('Búsqueda web terminada · 19 resultados devueltos · 8 candidatos reales');
  });

  it('without search telemetry there is no query text and no result count, just "desde el Goal"', () => {
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchQueries: ['legacy'], searchResultCount: 9 }) })} />);
    expect(container.querySelector('.forge-bench-q')?.textContent).toBe('«Rust ownership guide»');
    expect(container.querySelector('.forge-chip-tag')?.textContent).toBe('desde el Goal');
    expect(container.querySelector('.forge-live-counters [data-k="results"]')).toBeNull();
  });

  it('reports how many real candidates the search returned once the Kernel verifies them', () => {
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row() })} />);
    const bench = container.querySelector('.forge-bench') as HTMLElement;
    expect(bench.dataset.mode).toBe('searched');
    expect(container.querySelector('.forge-bench-meta')?.textContent).toBe('Búsqueda web terminada · 8 candidatos reales');
  });

  it('keeps the settled "hace …" clock advancing after the run ends instead of freezing at "hace 2 s"', () => {
    vi.useFakeTimers();
    try {
      const forgedAt = '2026-10-03T22:54:58.280Z';
      vi.setSystemTime(Date.parse(forgedAt) + 2_000);
      const model = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged'), mission: row({ status: 'completed', executionPhase: 'forged', forgedAt, completedAt: forgedAt }) });
      if (model.kind !== 'mission') throw new Error('expected a mission model');
      expect(model.phaseSince).toBe(forgedAt);
      expect(model.motion).toBe('settled');
      const { container } = render(<ForgeLiveView model={model} />);
      const clock = () => container.querySelector('.forge-live-clock')?.textContent;
      expect(clock()).toBe(' · hace menos de 1 min');
      act(() => { vi.advanceTimersByTime(3 * 60_000); });
      expect(clock()).toBe(' · hace 3 min');
      act(() => { vi.advanceTimersByTime(2 * 3_600_000); });
      expect(clock()).toBe(' · hace 2 h');
    } finally {
      vi.useRealTimers();
    }
    expect(formatAgo(0)).toBe('menos de 1 min');
    expect(formatAgo(59 * 60 + 59)).toBe('59 min');
    expect(formatAgo(47 * 3600)).toBe('47 h');
    expect(formatAgo(72 * 3600)).toBe('3 días');
  });

  it('clips long Kernel quotes for the card glance, preferring a sentence end', () => {
    expect(clipQuote('short quote', 150)).toEqual({ text: 'short quote', clipped: false });
    const long = 'Es una gran alternativa a los trabajos de conductor a tiempo completo y parcial o a otros empleos a tiempo parcial, temporales o estacionales. O tal vez ya seas conductor y quieras completar tus ganancias.';
    expect(clipQuote(long, 150)).toEqual({ text: long.slice(0, long.indexOf('. ')), clipped: true });
    const words = 'palabra '.repeat(40);
    const clipped = clipQuote(words, 50);
    expect(clipped.clipped).toBe(true);
    expect(clipped.text.length).toBeLessThanOrEqual(50);
    expect(clipped.text.endsWith('palabra')).toBe(true);
  });

  it('offers "Relanzar misión" only for a mission read without SUPPORT and no live lease', () => {
    const onRelaunch = vi.fn();
    const unsupported = [{ candidateId: 'c0', status: 'verified', evidenceId: 'e0', sourceUrl: candidates[0].url, supported: false, supportReason: 'homepage_insufficient_coverage' }];
    const stalled = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchCandidates: candidates.slice(0, 1), verificationResults: unsupported }) });
    const { rerender } = render(<ForgeLiveView model={stalled} onRelaunch={onRelaunch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Relanzar misión' }));
    expect(onRelaunch).toHaveBeenCalledWith('goal:1');
    rerender(<ForgeLiveView model={stalled} onRelaunch={onRelaunch} relaunchPending />);
    expect((screen.getByRole('button', { name: 'Relanzando…' }) as HTMLButtonElement).disabled).toBe(true);
    const leased = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchCandidates: candidates.slice(0, 1), verificationResults: unsupported, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() }) });
    rerender(<ForgeLiveView model={leased} onRelaunch={onRelaunch} />);
    expect(screen.queryByRole('button', { name: /Relanza/ })).toBeNull();
  });
});
