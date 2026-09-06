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
    supported: true,
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

describe('FindCard / FindsView mission-proof SUPPORT honesty', () => {
  const missionProof = {
    id: 'opp-mission-proof',
    title: 'Taladro mission-proof 19 EUR',
    category: 'offer',
    categoryLabel: 'Offer',
    benefitType: 'savings',
    sourceHost: 'shop.example',
    relevance: 70,
    nextAction: 'Verify terms',
    status: 'new' as const,
    detectedAt: '2026-09-02T00:00:00.000Z',
    evidenceId: 'ev-mission-1',
    caseId: 'case-mission-1',
    sourceUrl: 'https://shop.example/mission-proof-drill',
    // intentionally no item.supported — proof lives on verificationResults only
  };

  const missions = [{
    id: 'mission-proof',
    goalId: 'goal-1',
    status: 'completed' as const,
    executionPhase: 'forged',
    attempt: 1,
    createdAt: '2026-09-02T00:00:00.000Z',
    verificationResults: [{
      candidateId: 'cand-1',
      status: 'verified',
      evidenceId: 'ev-mission-1',
      supported: true,
      supportReason: 'supported',
    }],
  }];

  it('labels mission verificationResults SUPPORT as Kernel SUPPORT on Home FindCard', () => {
    render(<HomeView {...{
      phase: 'ready' as const,
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
    }} supportedFinds={[missionProof]} missions={missions} />);
    expect(screen.getByText('Taladro mission-proof 19 EUR')).toBeTruthy();
    expect(screen.getByText('Kernel SUPPORT')).toBeTruthy();
    expect(screen.queryByText('Lead no verificado')).toBeNull();
  });

  it('keeps mission-proof Finds in Hallazgos and labels Kernel SUPPORT', () => {
    render(
      <FindsView
        connected
        missions={missions}
        onFeedback={() => undefined}
        opportunities={[missionProof]}
      />,
    );
    expect(screen.getByText('Taladro mission-proof 19 EUR')).toBeTruthy();
    expect(screen.getByText('Kernel SUPPORT')).toBeTruthy();
    expect(screen.queryByText('Lead no verificado')).toBeNull();
    expect(screen.queryByText('Aún no hay hallazgos')).toBeNull();
    // Workspace copy must not brand SUPPORT Finds as lead no verificado.
    expect(screen.getByText(/Solo Finds con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/lead no verificado/i)).toBeNull();
  });

  it('fail-closes Hallazgos when mission proof is absent', () => {
    render(
      <FindsView
        connected
        missions={[]}
        onFeedback={() => undefined}
        opportunities={[missionProof]}
      />,
    );
    expect(screen.queryByText('Taladro mission-proof 19 EUR')).toBeNull();
    expect(screen.getByText('Aún no hay hallazgos')).toBeTruthy();
  });
});
