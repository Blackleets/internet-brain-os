// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceView, FindsView, GoalsView } from './efesto-product-views';
import type { OverviewSnapshot } from '../lib/kernel/overview';

afterEach(cleanup);

// Empty states along Goal -> Evidence -> Find explained what was missing but offered no way
// forward, and the empty Evidence list read "El Kernel devolvió una colección vacía".
const emptySnapshot: OverviewSnapshot = {
  readiness: { kernel: 'online' },
  metrics: { cases: 0, goals: 0, missions: 0, activeMissions: 0, opportunities: 0 },
  cases: [], goals: [], missions: [], opportunities: [], activity: [],
  loadedAt: '2026-09-28T10:00:00.000Z', issues: [],
};

describe('actionable empty states', () => {
  it('offline views offer to connect the Kernel', () => {
    const onConnect = vi.fn();
    render(<><GoalsView onNew={vi.fn()} onConnect={onConnect} /><FindsView opportunities={[]} connected={false} onFeedback={vi.fn()} onConnect={onConnect} /><EvidenceView cases={[]} selectedId="" loadingId="" connected={false} onOpen={vi.fn()} onConnect={onConnect} /></>);
    const buttons = screen.getAllByRole('button', { name: 'Conectar Kernel' });
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onConnect).toHaveBeenCalledTimes(3);
  });

  it('empty Goals and Finds lead to creating a Goal', () => {
    const onNewGoal = vi.fn();
    render(<><GoalsView snapshot={emptySnapshot} onNew={onNewGoal} /><FindsView opportunities={[]} connected onFeedback={vi.fn()} onNewGoal={onNewGoal} /></>);
    const buttons = screen.getAllByRole('button', { name: 'Crear un Goal' });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onNewGoal).toHaveBeenCalledTimes(buttons.length);
    expect(screen.getByText('Aún no hay hallazgos')).toBeTruthy();
  });

  it('empty Evidence explains where Cases come from instead of a raw API message', () => {
    const onNewGoal = vi.fn();
    render(<EvidenceView cases={[]} selectedId="" loadingId="" connected onOpen={vi.fn()} onNewGoal={onNewGoal} />);
    expect(screen.queryByText('El Kernel devolvió una colección vacía.')).toBeNull();
    expect(screen.getByText('Aún no hay Evidence')).toBeTruthy();
    expect(screen.getByText(/captura una página autorizada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear un Goal' }));
    expect(onNewGoal).toHaveBeenCalledTimes(1);
  });

  it('actions stay hidden when no handler is wired', () => {
    render(<FindsView opportunities={[]} connected={false} onFeedback={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Conectar Kernel' })).toBeNull();
  });

  it('the mounted shell wires the actions', () => {
    const shell = readFileSync(join(__dirname, 'efesto-product-shell.tsx'), 'utf8');
    expect(shell).toMatch(/<GoalsView [^\n]*onConnect=\{openSettings\}/);
    expect(shell).toMatch(/<FindsView [^\n]*onNewGoal=\{newGoal\} onConnect=\{openSettings\}/);
    expect(shell).toMatch(/<EvidenceView [^\n]*onNewGoal=\{newGoal\} onConnect=\{openSettings\}/);
  });
});
