import { describe, expect, it } from 'vitest';
import { deriveEfestoOrbState, selectNextGoal, shouldCreateMission } from './efesto-orb-state.js';

const now = Date.parse('2026-07-22T18:10:00.000Z');
const services = { hermes: 'ready', obsidian: 'configured' };

describe('Efesto orb deterministic UI state', () => {
  it('keeps OFF idle and never shows the smith working', () => {
    expect(deriveEfestoOrbState({ enabled: false, kernel: 'ready', services }).smithActive).toBe(false);
    expect(deriveEfestoOrbState({ enabled: false, kernel: 'ready', services }).state).toBe('idle');
  });

  it('stops the orb for failed missions', () => {
    const view = deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'failed', lastFailure: { reason: 'provider down' } }, now });
    expect(view).toMatchObject({ state: 'failed', active: false, smithActive: false, action: 'Retry safely' });
  });

  it('does not present an expired lease as researching', () => {
    const view = deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, now, mission: { status: 'running', leaseExpiresAt: '2026-07-22T18:00:00.000Z' } });
    expect(view.state).toBe('failed');
    expect(view.label).toBe('Lease expired safely');
  });

  it('shows Hermes unavailable for waiting_for_agent Goals', () => {
    const view = deriveEfestoOrbState({ enabled: true, kernel: 'ready', services: { obsidian: 'configured' }, mission: { status: 'waiting_for_agent' }, now });
    expect(view).toMatchObject({ state: 'failed', label: 'Hermes not available', active: false });
    expect(view.services.hermesReady).toBe(false);
  });

  it('maps queued and running missions to distinct real states', () => {
    expect(deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'queued' }, now }).state).toBe('queued');
    expect(deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'running', leaseExpiresAt: '2026-07-22T18:30:00.000Z' }, now }).state).toBe('researching');
  });

  it('keeps verification and Obsidian sync distinct', () => {
    expect(deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'running', executionPhase: 'verifying', leaseExpiresAt: '2026-07-22T18:30:00.000Z' }, now }).state).toBe('verifying');
    expect(deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'running', executionPhase: 'syncing', leaseExpiresAt: '2026-07-22T18:30:00.000Z' }, now }).state).toBe('syncing');
  });

  it('shows completed summaries and only confirmed Obsidian receipts', () => {
    const view = deriveEfestoOrbState({ enabled: true, kernel: 'ready', services, mission: { status: 'completed', resultSummary: { received: 2, evidenceCreated: 1, opportunitiesPromoted: 1, obsidianNotesWritten: 4 }, obsidianReceipt: { status: 'synced', notesWritten: 4, vaultRelativePath: '.hephaestus/obsidian-vault', lastSyncedAt: '2026-07-22T18:11:00.000Z' } }, now });
    expect(view.summary).toEqual({ findingsReceived: 2, evidenceCreated: 1, opportunitiesForged: 1, obsidianNotesWritten: 4 });
    expect(view.obsidianReceipt).toMatchObject({ status: 'synced', notesWritten: 4 });
  });

  it('selects the highest-priority unfinished Goal and prevents duplicate missions', () => {
    const goals = [{ id: 'low', priority: 1 }, { id: 'high', priority: 3 }];
    expect(selectNextGoal(goals, [])?.id).toBe('high');
    expect(shouldCreateMission({ enabled: true, kernel: 'ready', goals, mission: { status: 'queued' } })).toBe(false);
    expect(shouldCreateMission({ enabled: true, kernel: 'ready', goals, completedGoalIds: ['high'] })).toBe(true);
  });

  it('models Retry safely as a fresh attempt after terminal failure', () => {
    expect(shouldCreateMission({ enabled: true, kernel: 'ready', goals: [{ id: 'goal-1', priority: 2 }], mission: { status: 'failed', attempt: 3 } })).toBe(true);
  });
});
