// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewScreen } from './overview-screen';
import { isActiveMission, type OverviewSnapshot } from '../../lib/kernel/overview';

const snapshot: OverviewSnapshot = {
  readiness: {
    kernel: 'online',
    health: { ok: true, service: 'hephaestus-local-kernel', hermes: true, replayLab: true },
    status: {
      ok: true,
      service: 'hephaestus-local-kernel',
      kernel: 'ready',
      hermes: 'ready',
      replayLab: 'ready',
      ollama: 'configured',
      obsidian: 'configured',
    },
    bootstrap: {
      schemaVersion: 'efesto.bootstrap-status.v1',
      ok: true,
      kernel: 'ready',
      hermes: 'ready',
      obsidian: 'ready',
      pairing: 'paired',
      overall: 'ready',
      message: 'Kernel listo para operar.',
      diagnostics: {},
      actions: [],
    },
    modelForge: {
      runtime: 'available',
      hardware: { ramGiB: 8, cpuCores: 4, tier: 'balanced' },
      activeModel: 'qwen3:4b',
      recommended: 'qwen3:4b',
      models: [],
      setup: { action: 'configure', command: null, setting: null, restartRequired: false },
    },
  },
  metrics: { cases: 3, goals: 2, missions: 4, activeMissions: 1, opportunities: 5 },
  missions: [{
    id: 'mission-1',
    goalId: 'goal-1',
    status: 'running',
    executionPhase: 'verifying',
    attempt: 2,
    createdAt: '2026-07-26T10:00:00.000Z',
  }],
  opportunities: [{
    id: 'opportunity-1',
    title: 'Cliente potencial de automatización',
    category: 'client',
    categoryLabel: 'Cliente',
    benefitType: 'income',
    sourceHost: 'clientes.example',
    relevance: 72,
    nextAction: 'Revisar la necesidad antes de contactar.',
    status: 'new',
    detectedAt: '2026-07-26T10:00:00.000Z',
  }],
  activity: [{
    id: 'mission:mission-1',
    recordId: 'mission-1',
    kind: 'mission',
    timestamp: '2026-07-26T10:00:00.000Z',
    state: 'verifying',
  }],
  loadedAt: '2026-07-26T10:02:00.000Z',
  issues: [],
};

afterEach(cleanup);

describe('OverviewScreen', () => {
  it('renders the decorative Forge Core artwork without competing with Kernel status copy', () => {
    render(<OverviewScreen snapshot={snapshot} reload={vi.fn()} disconnect={vi.fn()} />);

    const artwork = document.querySelector('img.forge-core-artwork');
    expect(artwork).toBeTruthy();
    expect(artwork?.getAttribute('src')).toContain('forge-core.webp');
    expect(artwork?.getAttribute('alt')).toBe('');
    expect(artwork?.getAttribute('width')).toBe('1672');
    expect(artwork?.getAttribute('height')).toBe('941');
    expect(screen.getByText('Kernel conectado')).toBeTruthy();
  });

  it('renders exact live counts and explicitly unavailable projections', () => {
    render(<OverviewScreen snapshot={snapshot} reload={vi.fn()} disconnect={vi.fn()} />);

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getAllByText('Aún no expuesto por el Kernel')).toHaveLength(2);
  });

  it('uses persisted mission phases and preserves the unverified opportunity label', () => {
    render(<OverviewScreen snapshot={snapshot} reload={vi.fn()} disconnect={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Misiones activas' }).textContent).toContain('Verificando');
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByText('Lead no verificado')).toBeTruthy();
  });

  it('keeps successful panels visible while explaining a partial endpoint failure', () => {
    render(
      <OverviewScreen
        snapshot={{
          ...snapshot,
          readiness: { ...snapshot.readiness, modelForge: undefined },
          issues: [{ endpoint: 'modelForge', code: 'UNAVAILABLE' }],
        }}
        reload={vi.fn()}
        disconnect={vi.fn()}
      />,
    );

    expect(screen.getByText('Cliente potencial de automatización')).toBeTruthy();
    expect(screen.getByText(/Model Forge no está disponible/i)).toBeTruthy();
  });

  it('renders intentional empty collection states', () => {
    render(
      <OverviewScreen
        snapshot={{
          ...snapshot,
          metrics: { cases: 0, goals: 0, missions: 0, activeMissions: 0, opportunities: 0 },
          missions: [],
          opportunities: [],
          activity: [],
        }}
        reload={vi.fn()}
        disconnect={vi.fn()}
      />,
    );

    expect(screen.getByText('No hay misiones activas.')).toBeTruthy();
    expect(screen.getByText('No hay oportunidades priorizadas todavía.')).toBeTruthy();
    expect(screen.getByText('No hay actividad persistida para mostrar.')).toBeTruthy();
  });

  it.each([
    ['cases', 'Casos'],
    ['goals', 'Metas'],
    ['missions', 'Misiones'],
    ['opportunities', 'Oportunidades'],
  ] as const)('does not render failed %s reads as factual empty data', (endpoint, metricLabel) => {
    render(
      <OverviewScreen
        snapshot={{
          ...snapshot,
          metrics: { cases: 0, goals: 0, missions: 0, activeMissions: 0, opportunities: 0 },
          missions: [],
          opportunities: [],
          activity: [],
          issues: [{ endpoint, code: 'OFFLINE' }],
        }}
        reload={vi.fn()}
        disconnect={vi.fn()}
      />,
    );

    const metric = screen.getByRole('heading', { name: metricLabel }).closest('article')!;
    expect(metric.textContent).toContain('Datos temporalmente no disponibles');
    if (endpoint === 'missions') {
      expect(screen.getByRole('region', { name: 'Misiones activas' }).textContent).toContain('Datos temporalmente no disponibles');
    }
    if (endpoint === 'opportunities') {
      expect(screen.getByRole('region', { name: 'Prioridad de oportunidades' }).textContent).toContain('Datos temporalmente no disponibles');
    }
  });

  it('distinguishes unavailable readiness reads from an unconfigured subsystem', () => {
    render(
      <OverviewScreen
        snapshot={{
          ...snapshot,
          readiness: { ...snapshot.readiness, status: undefined, bootstrap: undefined },
          issues: [{ endpoint: 'status', code: 'OFFLINE' }, { endpoint: 'bootstrap', code: 'OFFLINE' }],
        }}
        reload={vi.fn()}
        disconnect={vi.fn()}
      />,
    );

    const readiness = screen.getByRole('region', { name: 'Estado de subsistemas' });
    expect(within(readiness).getAllByText('Estado temporalmente no disponible')).toHaveLength(5);
    expect(within(readiness).queryByText('No configurado')).toBeNull();
    expect(within(readiness).queryByText('Requiere emparejamiento')).toBeNull();
  });

  it('renders a health-offline snapshot as unavailable instead of factual empty data', () => {
    render(
      <OverviewScreen
        snapshot={{
          ...snapshot,
          readiness: { kernel: 'offline' },
          metrics: { cases: 0, goals: 0, missions: 0, activeMissions: 0, opportunities: 0 },
          missions: [],
          opportunities: [],
          activity: [],
          issues: [
            { endpoint: 'health', code: 'OFFLINE' },
            { endpoint: 'status', code: 'OFFLINE' },
            { endpoint: 'bootstrap', code: 'OFFLINE' },
            { endpoint: 'cases', code: 'UNAVAILABLE' },
            { endpoint: 'goals', code: 'UNAVAILABLE' },
            { endpoint: 'missions', code: 'UNAVAILABLE' },
            { endpoint: 'opportunities', code: 'UNAVAILABLE' },
            { endpoint: 'activity', code: 'UNAVAILABLE' },
            { endpoint: 'modelForge', code: 'UNAVAILABLE' },
          ],
        }}
        reload={vi.fn()}
        disconnect={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Kernel sin conexión')).toHaveLength(2);
    expect(screen.queryByText('Kernel conectado')).toBeNull();
    const readiness = screen.getByRole('region', { name: 'Estado de subsistemas' });
    expect(within(readiness).getByText('Kernel sin conexión')).toBeTruthy();
    expect(within(readiness).queryByText('Conexión local activa')).toBeNull();
    for (const label of ['Casos', 'Metas', 'Misiones', 'Misiones activas', 'Oportunidades']) {
      const metric = screen.getAllByRole('heading', { name: label }).map((heading) => heading.closest('article')).find(Boolean);
      expect(metric?.textContent).toContain('Datos temporalmente no disponibles');
    }
    expect(screen.getByRole('region', { name: 'Misiones activas' }).textContent).toContain('Datos temporalmente no disponibles');
    expect(screen.getByRole('region', { name: 'Prioridad de oportunidades' }).textContent).toContain('Datos temporalmente no disponibles');
    expect(screen.getByRole('region', { name: 'Actividad reciente' }).textContent).toContain('Datos temporalmente no disponibles');
  });

  it('renders only currently active persisted mission phases', () => {
    const missions = [
      { ...snapshot.missions[0], id: 'queued', status: 'queued' as const, executionPhase: 'queued' as const },
      { ...snapshot.missions[0], id: 'investigating', status: 'running' as const, executionPhase: 'investigating' as const },
      { ...snapshot.missions[0], id: 'verifying', status: 'running' as const, executionPhase: 'verifying' as const },
      { ...snapshot.missions[0], id: 'forged', status: 'completed' as const, executionPhase: 'forged' as const },
      { ...snapshot.missions[0], id: 'completed', status: 'completed' as const, executionPhase: undefined },
      { ...snapshot.missions[0], id: 'failed', status: 'failed' as const, executionPhase: 'failed' as const },
      { ...snapshot.missions[0], id: 'failed-phase', status: 'running' as const, executionPhase: 'failed' as const },
    ];
    const activeMissions = missions.filter(isActiveMission).length;
    render(<OverviewScreen snapshot={{ ...snapshot, missions, metrics: { ...snapshot.metrics, missions: missions.length, activeMissions } }} reload={vi.fn()} disconnect={vi.fn()} />);

    const panel = screen.getByRole('region', { name: 'Misiones activas' });
    expect(panel.textContent).toContain('Mision queued');
    expect(panel.textContent).toContain('Mision verifying');
    expect(panel.textContent).not.toContain('Mision forged');
    expect(panel.textContent).not.toContain('Mision completed');
    expect(panel.textContent).not.toContain('Mision failed');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(activeMissions);
  });

  it('marks a failed refresh stale until a later refresh succeeds', async () => {
    const reload = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(<OverviewScreen snapshot={snapshot} reload={reload} disconnect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar resumen' }));
    const stale = await screen.findByRole('status');
    expect(stale.textContent).toContain('Datos sin actualizar desde');
    expect(stale.querySelector(`time[datetime="${snapshot.loadedAt}"]`)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar resumen' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('offers labelled refresh and disconnect controls that work', async () => {
    const reload = vi.fn(async () => undefined);
    const disconnect = vi.fn();
    render(<OverviewScreen snapshot={snapshot} reload={reload} disconnect={disconnect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar resumen' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar del Kernel' }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
