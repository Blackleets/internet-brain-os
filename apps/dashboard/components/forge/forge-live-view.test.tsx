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
  it('explains a historical Goal revision block and only requests recovery on a click', () => {
    const onSearchMore = vi.fn();
    const record = row({ verifyingAt: '2026-10-03T09:03:00.000Z', verificationBlock: { reason: 'authorization_revision_mismatch' } });
    const build = (mission: MissionSummary) => buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission });
    const { rerender } = render(<ForgeLiveView model={build(record)} onSearchMore={onSearchMore} />);
    expect(onSearchMore).not.toHaveBeenCalled();
    expect(screen.getByText('Bloqueada · Goal actualizado')).toBeTruthy();
    expect(screen.getByText(/el bloqueo anterior queda en el historial/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar más' }));
    expect(onSearchMore).toHaveBeenCalledExactlyOnceWith('goal:1');
    rerender(<ForgeLiveView model={build(record)} onSearchMore={onSearchMore} relaunchPending />);
    expect((screen.getByRole('button', { name: 'Enviando…' }) as HTMLButtonElement).disabled).toBe(true);
    for (const extra of [{ verificationBlock: { reason: 'authorization_missing' } }, { leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() }]) {
      rerender(<ForgeLiveView model={build({ ...record, ...extra } as MissionSummary)} onSearchMore={onSearchMore} />);
      expect(screen.queryByRole('button', { name: 'Buscar más' })).toBeNull();
    }
  });

  it('adds only a local source identity and preserves candidate state and link', () => {
    const url = 'https://github.com/git-guides';
    const { container } = render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchCandidates: [{ ...candidates[0], url }] }) })} />);
    const link = screen.getByRole('link', { name: /Abrir fuente github.com/ });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.querySelector('img')?.getAttribute('src')).toBe('/brand/sources/github.png');
    expect(container.querySelector('.forge-source')?.getAttribute('data-state')).toBe('candidate');
    expect(container.querySelector('.forge-badge-final')?.textContent).toBe('CANDIDATO');
  });
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

  it('lists the pages each search returned (host + title, no links) only when the Kernel row carries them', () => {
    const base = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-10-03T09:01:00.000Z' };
    const view = (searches: unknown[]) => render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchTelemetry: { ...base, searches } }) })} />);
    const { container, unmount } = view([
      { query: 'rust ownership rules', limit: 10, resultCount: 2, results: [{ url: 'https://doc.rust-lang.org/book/ch04-01.html', title: 'What is Ownership?' }, { url: 'https://www.reddit.com/r/rust/x' }] },
      { query: 'rust borrow checker guide', limit: 10, resultCount: 0 },
    ]);
    const webs = container.querySelector('.forge-live-webs') as HTMLElement;
    expect(webs.querySelector('summary')?.textContent).toBe('Webs que devolvió la búsqueda 2');
    expect(webs.hasAttribute('open')).toBe(false);
    expect(webs.querySelectorAll('section')).toHaveLength(1);
    expect([...webs.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['doc.rust-lang.orgWhat is Ownership?', 'reddit.com']);
    expect(webs.querySelector('a')).toBeNull();
    expect(container.querySelector('.lg-web')).toBeTruthy();
    // still display-only: the counters are the real candidates / Evidence / SUPPORT
    expect((container.querySelector('.forge-live-counters [data-k="candidates"] dd') as HTMLElement).textContent).toBe('8');
    unmount();
    const none = view([{ query: 'rust ownership rules', limit: 10, resultCount: 10 }]);
    expect(none.container.querySelector('.forge-live-webs')).toBeNull();
    expect(none.container.querySelector('.lg-web')).toBeNull();
    none.unmount();
  });

  it('shows "N hallazgos devueltos · M descartados" only when the Kernel recorded a valid funnel', () => {
    const base = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-10-03T09:01:00.000Z', searches: [{ query: 'rust ownership rules', limit: 10, resultCount: 10 }] };
    const view = (searchTelemetry?: Record<string, unknown>) => render(<ForgeLiveView model={buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row(searchTelemetry ? { searchTelemetry } : {}) })} />);
    const { container, unmount } = view({ ...base, funnel: { findingsReturned: 12, dropped: { malformed_url: 1, duplicate: 1, per_domain_cap: 2 } } });
    const line = container.querySelector('.forge-panel-funnel');
    expect(line?.textContent).toBe('12 hallazgos devueltos · 4 descartados');
    expect(line?.getAttribute('title')).toBe('Descartados por el adaptador antes del Kernel — URL mal formada: 1 · duplicado: 1 · tope por dominio: 2');
    unmount();
    const none = view({ ...base, funnel: { findingsReturned: 1, dropped: {} } });
    expect(none.container.querySelector('.forge-panel-funnel')?.textContent).toBe('1 hallazgo devuelto · 0 descartados');
    none.unmount();
    // absent, unknown reason, out of bounds or not adding up: no line at all, never a guess
    for (const funnel of [undefined, { findingsReturned: 2, dropped: { spam: 1 } }, { findingsReturned: 21 }, { findingsReturned: 1, dropped: { other: 2 } }, { findingsReturned: '3' }]) {
      const other = view(funnel === undefined ? base : { ...base, funnel });
      expect(other.container.querySelector('.forge-panel-funnel')).toBeNull();
      other.unmount();
    }
    const noTelemetry = view();
    expect(noTelemetry.container.querySelector('.forge-panel-funnel')).toBeNull();
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

  it('offers "Buscar más" for a finished Mission and shows kept attempts apart, marked "intento anterior"', () => {
    const onSearchMore = vi.fn();
    const onRelaunch = vi.fn();
    const forgedResults = [{ candidateId: 'c0', status: 'verified', evidenceId: 'e0', sourceUrl: candidates[0].url, supported: true }];
    const forged = buildForgeModel({ connected: true, kernelOnline: true, surface: { ...surface('forged'), mission: { ...surface('forged').mission!, status: 'completed' } }, mission: row({ status: 'completed', executionPhase: 'forged', completedAt: '2026-10-03T09:05:00.000Z', searchCandidates: candidates.slice(0, 1), verificationResults: forgedResults }) });
    const { rerender } = render(<ForgeLiveView model={forged} onSearchMore={onSearchMore} onRelaunch={onRelaunch} />);
    expect(screen.queryByRole('button', { name: 'Relanzar misión' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Buscar más' }).getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/Los Finds y la Evidence guardados se conservan; lo nuevo se suma/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar más' }));
    expect(onSearchMore).toHaveBeenCalledWith('goal:1');
    rerender(<ForgeLiveView model={forged} onSearchMore={onSearchMore} relaunchPending />);
    expect((screen.getByRole('button', { name: 'Enviando…' }) as HTMLButtonElement).disabled).toBe(true);

    const prior = [{ status: 'completed', executionPhase: 'forged', searchCandidates: [], verificationResults: forgedResults }];
    const queued = buildForgeModel({ connected: true, kernelOnline: true, surface: { ...surface('queued'), mission: { ...surface('queued').mission!, status: 'queued' } }, mission: row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined, priorAttempts: prior }) });
    rerender(<ForgeLiveView model={queued} onSearchMore={onSearchMore} />);
    expect(screen.queryByRole('button', { name: 'Buscar más' })).toBeNull();
    const kept = screen.getByRole('list', { name: 'Fuentes de intentos anteriores (1)' });
    expect(within(kept).getByText('intento anterior')).toBeTruthy();
    expect(screen.getByText(/Intento anterior · 1 SUPPORT · 1 Evidence/)).toBeTruthy();
    expect(screen.getByLabelText('Contadores de la misión').textContent).toBe('candidatos0Evidence0SUPPORT0');
  });

  it('a stalled mission with "Buscar más" available offers it in the header instead of a plain "Relanzar misión" that would drop the kept attempts', () => {
    const onRelaunch = vi.fn();
    const onSearchMore = vi.fn();
    const unsupported = [{ candidateId: 'c0', status: 'verified', evidenceId: 'e0', sourceUrl: candidates[0].url, supported: false, supportReason: 'homepage_insufficient_coverage' }];
    const prior = [{ status: 'completed', executionPhase: 'forged', searchCandidates: [], verificationResults: [{ candidateId: 'p0', status: 'verified', evidenceId: 'ep', sourceUrl: 'https://kept.example/find', supported: true }] }];
    const stalled = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchCandidates: candidates.slice(0, 1), verificationResults: unsupported, priorAttempts: prior }) });
    render(<ForgeLiveView model={stalled} onRelaunch={onRelaunch} onSearchMore={onSearchMore} />);
    expect(screen.queryByRole('button', { name: 'Relanzar misión' })).toBeNull();
    const buttons = screen.getAllByRole('button', { name: 'Buscar más' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('header')).not.toBeNull();
    expect(screen.getByText(/conserva lo ya encontrado/)).toBeTruthy();
    fireEvent.click(buttons[0]);
    expect(onSearchMore).toHaveBeenCalledWith('goal:1');
    expect(onRelaunch).not.toHaveBeenCalled();
    expect(screen.getByText(/Intento anterior · 1 SUPPORT · 1 Evidence/)).toBeTruthy();
  });
});
