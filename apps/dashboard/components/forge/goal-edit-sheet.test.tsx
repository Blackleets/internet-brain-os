// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MissionSummary } from '../../lib/kernel/contracts';
import type { GoalSurface } from '../../lib/kernel/goal-surfaces';
import { buildForgeModel } from '../../lib/forge/forge-model';
import { ForgeLiveView } from './forge-live-view';

// Kernel-shaped TEST FIXTURES (not product data).
const MISSION_ID = 'mission:edit-test';
const TITLE = 'quiero budcar empleo de ryder o delivery en españa';
const surface = (revision = 1): GoalSurface => ({
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-04T10:00:00.000Z',
  goal: { id: 'goal:rider', title: TITLE, status: 'active', revision, createdAt: '2026-10-04T09:00:00.000Z', updatedAt: '2026-10-04T09:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  mission: { id: MISSION_ID, status: 'running', workState: 'verifying', createdAt: '2026-10-04T09:00:00.000Z', updatedAt: '2026-10-04T09:01:00.000Z' },
});
const row = (extra: Record<string, unknown> = {}) => ({ id: MISSION_ID, goalId: 'goal:rider', goalTitle: TITLE, status: 'running', executionPhase: 'verifying', createdAt: '2026-10-04T09:00:00.000Z', searchCandidates: [], ...extra }) as MissionSummary;
const NOW = Date.parse('2026-10-04T10:00:00.000Z');
const model = (extra: Record<string, unknown> = {}, revision = 1) => buildForgeModel({ connected: true, kernelOnline: true, surface: surface(revision), mission: row(extra), now: NOW });

afterEach(() => cleanup());

describe('"Editar Goal" (Kernel Goal revision)', () => {
  it('the forge model carries the confirmed Goal, its Kernel revision, and blocks the edit only under a live Hermes lease', () => {
    const idle = model({}, 3);
    expect(idle.kind === 'mission' && idle.editGoal).toEqual({ goalId: 'goal:rider', title: TITLE, revision: 3 });
    const leased = model({ leaseExpiresAt: '2026-10-04T10:05:00.000Z' });
    expect(leased.kind === 'mission' && leased.editGoal?.blocked).toMatch(/Hermes está trabajando/);
    const expired = model({ leaseExpiresAt: '2026-10-04T09:05:00.000Z' });
    expect(expired.kind === 'mission' && expired.editGoal?.blocked).toBeUndefined();
  });

  it('opens a labelled dialog from the Goal title, previews the next search keywords and saves a revision with the expected revision', async () => {
    const onEditGoal = vi.fn(async () => true);
    render(<ForgeLiveView model={model()} onEditGoal={onEditGoal} />);
    const open = screen.getByRole('button', { name: 'Editar Goal' });
    expect(open.closest('header')).not.toBeNull();
    fireEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Ajusta lo que buscas' });
    expect(within(dialog).getByText('EDITAR GOAL · REVISIÓN 1 → 2')).toBeTruthy();
    expect(within(dialog).getByText(/Se conservan el Goal, su misión, los intentos anteriores, la Evidence y los Finds/)).toBeTruthy();
    expect(within(dialog).getByText(/No ejecuta nada/)).toBeTruthy();
    const save = within(dialog).getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // unchanged text
    const field = within(dialog).getByLabelText('Texto del Goal');
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'empleo de rider o delivery en España' } });
    const keywords = within(dialog).getByLabelText('Palabras clave de la próxima búsqueda');
    expect(within(keywords).getByText('rider')).toBeTruthy();
    expect(within(keywords).getByText('rider').getAttribute('data-new')).toBe('true');
    expect(within(keywords).getByText('budcar').tagName).toBe('S');
    expect(within(keywords).getByText('ryder').tagName).toBe('S');
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onEditGoal).toHaveBeenCalledWith({ goalId: 'goal:rider', title: 'empleo de rider o delivery en España', expectedRevision: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar Goal' }));
  });

  it('keeps the dialog open when the Kernel refuses, and Escape / Cancelar close it without saving', async () => {
    const onEditGoal = vi.fn(async () => false);
    render(<ForgeLiveView model={model()} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    fireEvent.change(screen.getByLabelText('Texto del Goal'), { target: { value: 'empleo de rider en Madrid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(onEditGoal).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText('Texto del Goal'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onEditGoal).toHaveBeenCalledTimes(1);
  });

  it('while Hermes holds a lease the dialog explains why and cannot save; too-short text cannot save', () => {
    const onEditGoal = vi.fn(async () => true);
    const { unmount } = render(<ForgeLiveView model={model({ leaseExpiresAt: '2026-10-04T10:05:00.000Z' })} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    fireEvent.change(screen.getByLabelText('Texto del Goal'), { target: { value: 'empleo de rider' } });
    expect(screen.getByRole('status').textContent).toMatch(/Hermes está trabajando/);
    expect((screen.getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<ForgeLiveView model={model()} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    fireEvent.change(screen.getByLabelText('Texto del Goal'), { target: { value: 'ab' } });
    expect((screen.getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onEditGoal).not.toHaveBeenCalled();
  });

  it('is not offered without a revise handler (read-only surfaces)', () => {
    render(<ForgeLiveView model={model()} />);
    expect(screen.queryByRole('button', { name: 'Editar Goal' })).toBeNull();
  });
});
