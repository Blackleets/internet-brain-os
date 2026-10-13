// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EfestoProductShell from './efesto-product-shell';
import { statePillLabel, statePillTone } from '../lib/ui/state-pill-label.mjs';

// Honest-blocked Mission: the Kernel keeps executionPhase/workState `verifying` after
// verifying fetched pages with zero Kernel SUPPORT (L7 admits this). Home and Goals must
// stop claiming "Verificando Evidence — Kernel aplicando gates" once that verification
// finished, without inventing a Find or a green Completado lookalike.

const token = 'test-token-that-is-long-enough-for-kernel-validation';

type MissionRow = Record<string, unknown>;

// Shape the Kernel writes when a web.read batch settles without a Find
// (apps/local-kernel/mission-verification-settlement.mjs settleVerificationWithoutFind).
function kernelSettled(verificationResults: Array<Record<string, unknown>>): MissionRow {
  const read = verificationResults.filter((item) => item.status === 'verified').length;
  return {
    id: 'mission-1', goalId: 'goal-1', status: 'failed', executionPhase: 'failed', attempt: 1,
    createdAt: '2026-08-09T08:01:00.000Z', failedAt: '2026-08-09T08:03:00.000Z',
    lastFailure: { code: read > 0 ? 'verified_without_support' : 'web_read_failed', reason: 'Kernel web.read settlement', recordedAt: '2026-08-09T08:03:00.000Z', attempt: 1 },
    verificationResults,
  };
}

function fixtures(verificationResults: unknown[], settled?: MissionRow) {
  const missionRow: MissionRow = settled ?? { id: 'mission-1', goalId: 'goal-1', status: 'running', executionPhase: 'verifying', attempt: 1, createdAt: '2026-08-09T08:01:00.000Z', verificationResults };
  const workState = missionRow.executionPhase ?? missionRow.status;
  return {
    '/health': { ok: true, service: 'hephaestus-local-kernel', hermes: true, replayLab: true },
    '/status': { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'ready', replayLab: 'ready', ollama: 'configured', obsidian: 'configured' },
    '/bootstrap/status': { schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready', message: 'ready', diagnostics: {}, actions: [] },
    '/api/cases': { ok: true, cases: [] },
    '/api/goals': { ok: true, goals: [{ id: 'goal-1', title: 'Git version control', priority: 2, status: 'active', createdAt: '2026-08-09T08:00:00.000Z' }] },
    '/api/agent-missions': { ok: true, missions: [missionRow] },
    '/api/goal-surfaces': { ok: true, surfaces: [{ schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-08-09T08:04:00.000Z', goal: { id: 'goal-1', title: 'Git version control', status: 'active', revision: 1, createdAt: '2026-08-09T08:00:00.000Z', updatedAt: '2026-08-09T08:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } }, mission: { id: 'mission-1', status: missionRow.status, executionPhase: missionRow.executionPhase, workState, createdAt: '2026-08-09T08:01:00.000Z', updatedAt: '2026-08-09T08:04:00.000Z', attempt: 1, findCount: 0 } }] },
    '/api/opportunities': { ok: true, opportunities: [] },
    '/api/chat/providers': { ok: true, providers: [] },
  } as Record<string, unknown>;
}

function stubKernel(verificationResults: unknown[], settled?: MissionRow) {
  const body = fixtures(verificationResults, settled);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, { ...init, signal: undefined });
    const payload = body[new URL(request.url).pathname];
    return payload ? Response.json(payload) : Response.json({ ok: false }, { status: 404 });
  }));
}

const activeGoalsSidebar = () => within(screen.getByRole('region', { name: 'Objetivos activos' }));

async function connectAndOpenHome() {
  render(<EfestoProductShell />);
  fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
  fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Kernel listo/ })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe('verifying Mission whose verification finished with zero Kernel SUPPORT', () => {
  it('Home says Sin SUPPORT with neutral chrome instead of Verificando Evidence forever', async () => {
    stubKernel([
      { candidateId: 'c1', status: 'verified', sourceUrl: 'https://github.com/git/', evidenceId: 'ev-1', supported: false, supportReason: 'insufficient_term_coverage' },
      { candidateId: 'c2', status: 'verification_failed', reason: 'fetch_failed' },
    ]);
    await connectAndOpenHome();
    const label = await screen.findByText('Sin SUPPORT');
    const stateAction = label.closest('button');
    expect(stateAction?.className).toContain('phase-research_completed');
    expect(stateAction?.className).not.toContain('phase-verifying');
    expect(screen.queryByText('Verificando Evidence')).toBeNull();
    expect(screen.queryByText(/completado|Find SUPPORT forjado/i)).toBeNull();

    // Sidebar "Objetivos activos" must not keep claiming the Kernel is still reading.
    expect(activeGoalsSidebar().getByText('sin SUPPORT')).toBeTruthy();
    expect(activeGoalsSidebar().queryByText('Kernel leyendo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Objetivos/ }));
    expect(await screen.findByText('Sin SUPPORT')).toBeTruthy();
    expect(screen.queryByText('Verificando')).toBeNull();
  });

  it('Kernel settlement verified_without_support is Sin SUPPORT on Home and sidebar, never falló', async () => {
    // Kernel mint path: one attempt read a page (HTTP 200 → Evidence), none passed SUPPORT.
    const results = [
      { candidateId: 'c1', status: 'verified', sourceUrl: 'https://github.com/git/', evidenceId: 'ev-1', supported: false, supportReason: 'insufficient_term_coverage' },
      { candidateId: 'c2', status: 'verification_failed', reason: 'fetch_failed' },
    ];
    const settled = kernelSettled(results);
    expect(settled.lastFailure).toMatchObject({ code: 'verified_without_support' });
    stubKernel(results, settled);
    await connectAndOpenHome();
    expect(await screen.findByText('Sin SUPPORT')).toBeTruthy();
    const goal = activeGoalsSidebar().getByRole('button', { name: /Git version control/ });
    expect(within(goal).getByText('sin SUPPORT')).toBeTruthy();
    expect(within(goal).queryByText('falló')).toBeNull();
    expect(goal.querySelector('i')?.getAttribute('data-tone')).toBe('idle');
    expect(screen.queryByText(/completado|Find SUPPORT forjado|· forjado/i)).toBeNull();
  });

  it('web_read_failed (nothing could be read) still reads as falló in the sidebar', async () => {
    const results = [{ candidateId: 'c1', status: 'verification_failed', reason: 'fetch_failed' }];
    const settled = kernelSettled(results);
    expect(settled.lastFailure).toMatchObject({ code: 'web_read_failed' });
    stubKernel(results, settled);
    await connectAndOpenHome();
    const goal = await waitFor(() => activeGoalsSidebar().getByRole('button', { name: /Git version control/ }));
    expect(within(goal).getByText('falló')).toBeTruthy();
    expect(within(goal).queryByText('sin SUPPORT')).toBeNull();
  });

  it('keeps Verificando Evidence when every fetch failed (verification retry still possible)', async () => {
    stubKernel([{ candidateId: 'c1', status: 'verification_failed', reason: 'fetch_failed' }]);
    await connectAndOpenHome();
    expect(await screen.findByText('Verificando Evidence')).toBeTruthy();
    expect(screen.queryByText('Sin SUPPORT')).toBeNull();
  });

  it('labels the pill honestly and never as working/good', () => {
    expect(statePillLabel('verified_unsupported')).toBe('Sin SUPPORT');
    expect(statePillTone('verified_unsupported')).toBe('neutral');
  });
});
