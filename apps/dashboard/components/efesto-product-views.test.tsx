// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormEvent } from 'react';
import { ActivityView, AgentsView, FindsView, GoalsView, HomeView, brainState, type ChatMessage, type Provider } from './efesto-product-views';
import type { OverviewSnapshot } from '../lib/kernel/overview';
import type { MissionSummary } from '../lib/kernel/contracts';

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
            executionPhase: 'forged' as const,
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
    // Fail-close: Home finds chrome/h1 must name Kernel SUPPORT (supportedFinds is SUPPORT-only).
    expect(screen.getByRole('heading', { name: 'Hallazgo · Kernel SUPPORT' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hallazgo útil' })).toBeNull();
    expect(screen.getByText('Taladro Bosch 21 EUR')).toBeTruthy();
    expect(screen.getAllByText('Kernel SUPPORT').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Abrir fuente/ }).getAttribute('href')).toBe('https://shop.example/drill');
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
  });

  it('Home finds surfaceTitle names Kernel SUPPORT, never bare Hallazgo útil alone', () => {
    // page.tsx → EfestoProductShell → HomeView; supportedFinds is kernelSupportedFinds-only.
    render(<HomeView {...homeProps} supportedFinds={[supported]} />);
    // Chrome strong + h1 both name SUPPORT (gate-blind Hallazgo útil must not remain).
    expect(screen.getAllByText('Hallazgo · Kernel SUPPORT').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Hallazgo útil')).toBeNull();
  });

  it('Home forge-state-action names SUPPORT when forged with Finds', () => {
    // page.tsx → EfestoProductShell → HomeView forge-state-action uses brainState(phase, forgeSupportedFindCount).
    // Gate-blind "Evidence forjada" must not remain when Kernel SUPPORT Finds exist.
    render(<HomeView {...homeProps} phase="forged" connected supportedFinds={[supported]} forgeSupportedFindCount={1} />);
    const action = screen.getByRole('button', { name: 'Kernel conectado' });
    expect(action.textContent).toMatch(/Find SUPPORT forjado/i);
    expect(action.textContent).not.toMatch(/Evidence forjada/i);
    expect(action.textContent).not.toMatch(/Completado/i);
  });

  it('Home forge-state-action ignores global inbox Finds for zero-SUPPORT forged mission', () => {
    // phase is focusedGoalSurface.mission; forgeSupportedFindCount is mission-scoped.
    // Older inbox SUPPORT Finds must not brand Investigación terminada as Find SUPPORT forjado.
    render(
      <HomeView
        {...homeProps}
        phase="forged"
        connected
        supportedFinds={[supported]}
        forgeSupportedFindCount={0}
      />,
    );
    const action = screen.getByRole('button', { name: 'Kernel conectado' });
    expect(action.textContent).toMatch(/Investigación terminada/i);
    expect(action.textContent).not.toMatch(/Find SUPPORT forjado/i);
    expect(action.textContent).not.toMatch(/Evidence forjada|Completado/i);
    // Inbox chrome may still show SUPPORT Finds — only forge-state-action is mission-scoped.
    expect(screen.getByText('Taladro Bosch 21 EUR')).toBeTruthy();
  });

  it('Home forge-state-action zero-SUPPORT forged is Investigación terminada', () => {
    // Forged without Kernel SUPPORT Finds must not brand Completado / useful Find / Evidence forjada.
    render(<HomeView {...homeProps} phase="forged" connected supportedFinds={[]} />);
    const action = screen.getByRole('button', { name: 'Kernel conectado' });
    expect(action.textContent).toMatch(/Investigación terminada/i);
    expect(action.textContent).not.toMatch(/Evidence forjada/i);
    expect(action.textContent).not.toMatch(/Completado|Find SUPPORT/i);
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

  it('Goal plan must not equate forging Evidence with a Find', () => {
    render(<HomeView {...homeProps} preparedGoal="Buscar taladro Bosch" supportedFinds={[]} />);
    const plan = screen.getByLabelText('Plan propuesto');
    expect(plan.textContent).toMatch(/Forjar Evidence · Finds SUPPORT/i);
    expect(plan.textContent).toMatch(/Forjar Evidence no es un Find/i);
    expect(plan.textContent).toMatch(/Kernel SUPPORT/i);
    expect(plan.textContent).not.toMatch(/Forjar Evidence y Finds/i);
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

  const missions: MissionSummary[] = [{
    id: 'mission-proof',
    goalId: 'goal-1',
    status: 'completed',
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

  it('empty Hallazgos copy requires Kernel SUPPORT and never equates promotion with a Find', () => {
    render(
      <FindsView
        connected
        missions={[]}
        onFeedback={() => undefined}
        opportunities={[]}
      />,
    );
    expect(screen.getByText('Aún no hay hallazgos')).toBeTruthy();
    expect(screen.getByText(/Solo aparecen Finds con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/resultados promovidos/i)).toBeNull();
    expect(screen.getByText(/promover o completar no es un Find/i)).toBeTruthy();
  });

  it('disconnected Hallazgos empty must name Kernel SUPPORT like bandeja sibling', () => {
    // Without connection FindsView keeps the empty mounted — gate-blind "hallazgos reales"
    // must name Kernel SUPPORT like the connected empty and extension bandeja HTML.
    render(
      <FindsView
        connected={false}
        missions={[]}
        onFeedback={() => undefined}
        opportunities={[]}
      />,
    );
    expect(screen.getByText('Kernel sin conexión')).toBeTruthy();
    expect(screen.getByText(/cargar hallazgos con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/cargar hallazgos reales/i)).toBeNull();
  });
});

describe('AgentsView Hermes return honesty', () => {
  it('must not brand Hermes candidates as findings before Kernel SUPPORT', () => {
    render(
      <AgentsView
        snapshot={snapshotWithMissions([])}
        onSettings={() => undefined}
        onNewGoal={() => undefined}
      />,
    );
    expect(screen.getByText(/Sus candidatos deben regresar por el bridge autenticado/i)).toBeTruthy();
    expect(screen.getByText(/Un Find exige Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/Sus findings deben/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Hermes Agent' })).toBeTruthy();
  });
});

describe('ActivityView Kernel SUPPORT honesty', () => {
  it('empty Actividad must name Kernel SUPPORT for hallazgos (Evidence≠Find)', () => {
    // overview activityFrom only lists opportunity rows with Kernel SUPPORT.
    // Gate-blind "un hallazgo" must name SUPPORT like Hallazgos / FindCard honesty.
    render(
      <ActivityView
        connected
        snapshot={snapshotWithMissions([])}
      />,
    );
    expect(screen.getByText('Sin actividad publicada')).toBeTruthy();
    expect(screen.getByText(/hallazgo con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.getByText(/hallazgos con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/una misión o un hallazgo, aparecerá/i)).toBeNull();
  });

  it('disconnected Actividad empty must name Kernel SUPPORT like Hallazgos sibling', () => {
    // Without connection ActivityView keeps the empty mounted. overview activityFrom only
    // lists opportunity rows with Kernel SUPPORT — gate-blind "actividad real" must name
    // SUPPORT like the connected empty and Hallazgos disconnected honesty.
    render(<ActivityView connected={false} />);
    expect(screen.getByText('Kernel sin conexión')).toBeTruthy();
    expect(screen.getByText(/Conecta el Kernel para leer actividad real de Goals, misiones y hallazgos con Kernel SUPPORT/i)).toBeTruthy();
    expect(screen.queryByText(/^Conecta el Kernel para leer actividad real\.$/)).toBeNull();
  });

  it('opportunity activity rows must name Kernel SUPPORT Hallazgo', () => {
    const snapshot = snapshotWithMissions([]);
    snapshot.activity = [
      {
        id: 'opportunity:opp-1',
        recordId: 'opp-1',
        kind: 'opportunity',
        timestamp: '2026-07-26T10:00:00.000Z',
        state: 'new',
      },
    ];
    render(<ActivityView connected snapshot={snapshot} />);
    expect(screen.getByText('Hallazgo · Kernel SUPPORT')).toBeTruthy();
    expect(screen.queryByText(/^Hallazgo$/)).toBeNull();
  });
});

describe('brainState forged SUPPORT honesty', () => {
  it('names Kernel SUPPORT Finds when forged with finds', () => {
    expect(brainState('forged', 1).label).toMatch(/Find SUPPORT forjado/i);
    expect(brainState('forged', 2).label).toMatch(/Finds SUPPORT forjados/i);
    expect(brainState('forged', 1).label).not.toMatch(/Evidence forjada/i);
    expect(brainState('forged', 1).detail).toMatch(/Kernel SUPPORT/i);
  });

  it('zero-SUPPORT forged is Investigación terminada, not Evidence forjada Completado', () => {
    expect(brainState('forged', 0).label).toBe('Investigación terminada');
    expect(brainState('forged', 0).detail).toMatch(/Ningún Find pasó Kernel SUPPORT/i);
    expect(brainState('forged', 0).label).not.toMatch(/Evidence forjada|Completado|Find SUPPORT/i);
  });
});

describe('Home forge-state-action shell wiring contract', () => {
  it('shell feeds focused-mission SUPPORT count, never global supportedFinds.length', () => {
    const shell = readFileSync(join(process.cwd(), 'apps/dashboard/components/efesto-product-shell.tsx'), 'utf8');
    const views = readFileSync(join(process.cwd(), 'apps/dashboard/components/efesto-product-views.tsx'), 'utf8');
    expect(shell).toContain('countMissionKernelSupportedFinds(focusedGoalSurface?.mission)');
    expect(shell).toContain('forgeSupportedFindCount={forgeSupportedFindCount}');
    expect(views).toContain('brainState(phase, forgeSupportedFindCount)');
    expect(views).not.toContain('brainState(phase, supportedFinds.length)');
  });
});

