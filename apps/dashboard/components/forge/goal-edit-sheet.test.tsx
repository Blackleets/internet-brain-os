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
const row = (extra: Record<string, unknown> = {}) => ({ id: MISSION_ID, goalId: 'goal:rider', goalTitle: TITLE, status: 'failed', executionPhase: 'failed', createdAt: '2026-10-04T09:00:00.000Z', searchCandidates: [], ...extra }) as MissionSummary;
const NOW = Date.parse('2026-10-04T10:00:00.000Z');
const model = (extra: Record<string, unknown> = {}, revision = 1) => buildForgeModel({ connected: true, kernelOnline: true, surface: surface(revision), mission: row(extra), now: NOW });
const running = { status: 'running', executionPhase: 'verifying' };

afterEach(() => cleanup());

describe('"Editar Goal" (Kernel Goal revision)', () => {
  it('carries the confirmed Goal revision and blocks live leases and pending verification even without a lease', () => {
    const idle = model({}, 3);
    expect(idle.kind === 'mission' && idle.editGoal).toEqual({ goalId: 'goal:rider', title: TITLE, revision: 3 });
    const leased = model({ ...running, leaseExpiresAt: '2026-10-04T10:05:00.000Z' });
    expect(leased.kind === 'mission' && leased.editGoal?.blocked).toMatch(/Hermes está trabajando/);
    for (const extra of [{}, { leaseExpiresAt: '2026-10-04T09:05:00.000Z' }]) {
      const pending = model({ ...running, ...extra });
      expect(pending.kind === 'mission' && pending.editGoal?.blocked).toMatch(/Kernel está verificando/);
    }
    const expiredDiscovery = model({ status: 'running', executionPhase: 'investigating', leaseExpiresAt: '2026-10-04T09:05:00.000Z' });
    expect(expiredDiscovery.kind === 'mission' && expiredDiscovery.editGoal?.blocked).toBeUndefined();
  });

  it('does not freeze an already blocked or settleable batch; partial and supported batches still block', () => {
    const searchCandidates = [{ id: 'candidate-a' }, { id: 'candidate-b' }];
    const partial = [{ candidateId: 'candidate-a', status: 'verified', supported: false }];
    const all = [...partial, { candidateId: 'candidate-b', status: 'verification_failed' }];
    for (const verificationResults of [partial, [...all, { candidateId: 'candidate-a', supported: true }]]) {
      const pending = model({ ...running, searchCandidates, verificationResults });
      expect(pending.kind === 'mission' && pending.editGoal?.blocked).toMatch(/Kernel está verificando/);
    }
    for (const extra of [{ searchCandidates, verificationResults: all }, { verificationBlock: { reason: 'authorization_revision_mismatch' } }]) {
      const editable = model({ ...running, ...extra });
      expect(editable.kind === 'mission' && editable.editGoal?.blocked).toBeUndefined();
    }
  });

  it('retains typed text while verification begins and enables saving after the Kernel finishes', () => {
    const onEditGoal = vi.fn(async () => true);
    const { rerender } = render(<ForgeLiveView model={model()} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    const field = screen.getByLabelText('Texto del Goal') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'empleo de rider en Madrid' } });
    rerender(<ForgeLiveView model={model(running)} onEditGoal={onEditGoal} />);
    expect(field.value).toBe('empleo de rider en Madrid');
    expect(screen.getByRole('status').textContent).toMatch(/Kernel está verificando/);
    expect((screen.getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(field.closest('form')!);
    expect(onEditGoal).not.toHaveBeenCalled();
    rerender(<ForgeLiveView model={model({ status: 'completed', executionPhase: 'forged' })} onEditGoal={onEditGoal} />);
    expect(field.value).toBe('empleo de rider en Madrid');
    expect((screen.getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement).disabled).toBe(false);
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

  it('keeps Tab and Shift+Tab inside the edit dialog', () => {
    render(<ForgeLiveView model={model()} onEditGoal={async () => true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    const first = screen.getByRole('button', { name: 'Cerrar edición' });
    const field = screen.getByLabelText('Texto del Goal');
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    fireEvent.change(field, { target: { value: 'empleo de rider en Madrid' } });
    const save = screen.getByRole('button', { name: 'Guardar revisión' });
    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('retains edited text and recovers the controls after a rejected save, without leaking diagnostics', async () => {
    const onEditGoal = vi.fn().mockRejectedValueOnce(new Error('private-token-secret')).mockResolvedValueOnce(true);
    render(<ForgeLiveView model={model()} onEditGoal={onEditGoal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Goal' }));
    const field = screen.getByLabelText('Texto del Goal') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'empleo de rider en Madrid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(field.value).toBe('empleo de rider en Madrid');
    expect(screen.getByRole('alert').textContent).not.toContain('private-token-secret');
    expect((screen.getByRole('button', { name: 'Guardar revisión' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onEditGoal).toHaveBeenCalledTimes(2);
  });

  it('while Hermes holds a lease the dialog explains why and cannot save; too-short text cannot save', () => {
    const onEditGoal = vi.fn(async () => true);
    const { unmount } = render(<ForgeLiveView model={model({ ...running, leaseExpiresAt: '2026-10-04T10:05:00.000Z' })} onEditGoal={onEditGoal} />);
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
