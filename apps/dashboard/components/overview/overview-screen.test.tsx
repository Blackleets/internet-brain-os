// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewScreen } from './overview-screen';
import type { OverviewSnapshot } from '../../lib/kernel/overview';

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

    expect(screen.getByText('No hay misiones persistidas todavía.')).toBeTruthy();
    expect(screen.getByText('No hay oportunidades priorizadas todavía.')).toBeTruthy();
    expect(screen.getByText('No hay actividad persistida para mostrar.')).toBeTruthy();
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
