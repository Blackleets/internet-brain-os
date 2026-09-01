// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormEvent } from 'react';
import { FindsView, GoalsView, HomeView, type ChatMessage, type Provider } from './efesto-product-views';
import type { OverviewSnapshot } from '../lib/kernel/overview';

afterEach(cleanup);

function snapshotWithMissions(missions: OverviewSnapshot['missions']): OverviewSnapshot {
  return {
    readiness: { kernel: 'online' },
    metrics: { cases: 0, goals: 1, missions: missions.length, activeMissions: 0, opportunities: 0 },
    cases: [],
    goals: [{ id: 'goal-1', title: 'Find a drill offer', priority: 2, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' }],
    missions,
    opportunities: [],
    activity: [],
    loadedAt: '2026-07-26T10:05:00.000Z',
    issues: [],
  };
}

describe('GoalsView mission StatePill honesty', () => {
  it('does not present completed-without-forged as Completado/completed', () => {
    const { container } = render(
      <GoalsView
        snapshot={snapshotWithMissions([
          {
            id: 'mission-bare',
            goalId: 'goal-1',
            status: 'completed',
            attempt: 1,
            createdAt: '2026-07-26T10:03:00.000Z',
          },
        ])}
        onNew={() => undefined}
      />,
    );
    const pill = container.querySelector('.state-pill');
    expect(pill?.textContent).toMatch(/completed without forge/i);
    expect(pill?.textContent).not.toMatch(/^\s*completed\s*$/i);
    expect(pill?.className).not.toMatch(/\bgood\b/);
    expect(screen.getByText('Find a drill offer')).toBeTruthy();
  });

  it('presents Kernel forged missions as forged', () => {
    const { container } = render(
      <GoalsView
        snapshot={snapshotWithMissions([
          {
            id: 'mission-forged',
            goalId: 'goal-1',
            status: 'completed',
            executionPhase: 'forged',
            attempt: 1,
            createdAt: '2026-07-26T10:04:00.000Z',
          },
        ])}
        onNew={() => undefined}
      />,
    );
    const pill = container.querySelector('.state-pill');
    expect(pill?.textContent).toMatch(/forged/i);
    expect(pill?.className).toMatch(/\bgood\b/);
  });
});

describe('HomeView Kernel-supported Find', () => {
  const homeProps = {
    phase: 'forged' as const,
    chatMode: false,
    messages: [] as ChatMessage[],
    preparedGoal: '',
    connected: true,
    goalPending: false,
    input: '',
    onInputChange: () => undefined,
    onSubmit: (event: FormEvent<HTMLFormElement>) => event.preventDefault(),
    onToggleChat: () => undefined,
    chatPending: false,
    onStopChat: () => undefined,
    chatAvailable: false,
    submitDisabled: true,
    onConfirmGoal: () => undefined,
    onEditGoal: () => undefined,
    onStarterGoal: () => undefined,
    onStarterChat: () => undefined,
    onOpenModels: () => undefined,
    modelLabel: 'Sin modelo',
    providers: [] as Provider[],
    selectedProviderId: '',
    selectedModel: '',
    onSelectModel: () => undefined,
    onOpenSettings: () => undefined,
    onOpenNav: () => undefined,
  };

  const supported = {
    id: 'opp-supported',
    title: 'Taladro Bosch 21 EUR',
    category: 'offer',
    categoryLabel: 'Offer',
    benefitType: 'savings',
    sourceHost: 'shop.example',
    relevance: 80,
    nextAction: 'Verify terms',
    status: 'new' as const,
    detectedAt: '2026-09-02T00:00:00.000Z',
    evidenceId: 'ev-1',
    caseId: 'case-1',
    sourceUrl: 'https://shop.example/drill',
  };

  it('renders persisted Kernel Find title, sourceUrl and SUPPORT provenance', () => {
    render(<HomeView {...homeProps} supportedFinds={[supported]} />);
    expect(screen.getByRole('heading', { name: 'Hallazgo útil' })).toBeTruthy();
    expect(screen.getByText('Taladro Bosch 21 EUR')).toBeTruthy();
    expect(screen.getByText('Kernel SUPPORT')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir fuente/ }).getAttribute('href')).toBe('https://shop.example/drill');
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
  });

  it('does not mint a Find card from a Hermes snippet', () => {
    render(<HomeView {...homeProps} phase="verifying" supportedFinds={[]} />);
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
    expect(screen.queryByText('Kernel SUPPORT')).toBeNull();
    expect(screen.getByRole('heading', { name: '¿Qué estás buscando?' })).toBeTruthy();
    expect(screen.getByText('Verificando Evidence')).toBeTruthy();
    expect(screen.queryByText(/completado/i)).toBeNull();
  });

  it('keeps verifying when Evidence exists without Completado', () => {
    render(<HomeView {...homeProps} phase="verifying" supportedFinds={[supported]} />);
    expect(screen.getByText('Taladro Bosch 21 EUR')).toBeTruthy();
    expect(screen.getByText('Verificando Evidence')).toBeTruthy();
    expect(screen.queryByText(/completado/i)).toBeNull();
  });
});

describe('FindsView fail-closes snippet-only opportunities', () => {
  it('hides opportunities without Kernel Evidence provenance', () => {
    render(
      <FindsView
        connected
        onFeedback={() => undefined}
        opportunities={[{
          id: 'opp-snippet',
          title: 'Hermes snippet drill',
          category: 'offer',
          categoryLabel: 'Offer',
          benefitType: 'savings',
          sourceHost: 'search.example',
          relevance: 40,
          nextAction: 'Ignore snippet',
          status: 'new',
          detectedAt: '2026-09-02T00:00:00.000Z',
        }]}
      />,
    );
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
    expect(screen.getByText('Aún no hay hallazgos')).toBeTruthy();
  });
});
