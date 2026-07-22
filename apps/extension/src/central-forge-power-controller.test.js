import { describe, expect, it, vi } from 'vitest';
import { createForgePowerController, renderForgePowerView } from './central-forge-power-controller.js';

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeButton extends EventTarget {
  constructor() { super(); this.dataset = {}; this.attributes = {}; this.addCount = 0; this.textContent = ''; this.disabled = false; }
  addEventListener(type, listener, options) { if (type === 'click') this.addCount += 1; return super.addEventListener(type, listener, options); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  click() { this.dispatchEvent(new Event('click', { bubbles: true })); }
}

function textNode() { return { textContent: '' }; }

function harness({ stored = {}, bootstrap = { kernel: 'ready', hermes: 'ready', obsidian: 'ready' }, missions = [], goals = [{ id: 'goal-1', title: 'Find work', priority: 2 }] } = {}) {
  const button = new FakeButton();
  const label = textNode();
  const detail = textNode();
  const calls = { start: [], storageSet: [] };
  const storageState = { kernelApiToken: 'x'.repeat(40), efestoForgeEnabled: false, ...stored };
  const controller = createForgePowerController({
    elements: { powerButton: button, powerLabel: label, powerDetail: detail, livingForge: { setAttribute: vi.fn() } },
    storage: {
      get: vi.fn(async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, storageState[key]]))),
      set: vi.fn(async (next) => { Object.assign(storageState, next); calls.storageSet.push(next); }),
    },
    transport: {
      getEfestoBootstrapStatus: vi.fn(async () => bootstrap),
      listAgentMissions: vi.fn(async () => missions),
      listGoals: vi.fn(async () => goals),
      startGoalResearch: vi.fn(async (goalId) => { calls.start.push(goalId); return { id: `mission-${calls.start.length}`, goalId, status: 'queued', createdAt: new Date().toISOString() }; }),
    },
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  controller.attach();
  return { button, label, detail, calls, controller };
}

describe('central forge power controller', () => {
  it('attaches exactly one click listener even if initialized twice', () => {
    const { button, controller } = harness();
    controller.attach();
    expect(button.addCount).toBe(1);
  });

  it('marks click receipt and starting state immediately before Kernel response', async () => {
    const { button, detail } = harness();
    button.click();
    expect(button.dataset.clickReceived).toBe('true');
    expect(button.dataset.state).toBe('starting');
    expect(detail.textContent).toMatch(/Starting the forge|Retrying/);
  });

  it('a click creates exactly one mission', async () => {
    const { button, calls } = harness();
    button.click();
    await flushAsync();
    await flushAsync();
    expect(calls.start).toEqual(['goal-1']);
  });

  it('double click does not duplicate the mission while a cycle is running', async () => {
    const { button, calls } = harness();
    button.click(); button.click();
    await flushAsync();
    await flushAsync();
    expect(calls.start).toEqual(['goal-1']);
  });

  it('ignores a second press while the first press is still starting', async () => {
    const { button, calls } = harness();
    button.click();
    await flushAsync();
    button.click();
    await flushAsync();
    await flushAsync();
    expect(calls.start).toEqual(['goal-1']);
  });

  it('waiting_for_agent with Hermes ready restarts mission', async () => {
    const { button, calls } = harness({ stored: { efestoForgeEnabled: true }, missions: [{ id: 'old', goalId: 'goal-1', status: 'waiting_for_agent', createdAt: '2026-07-22T19:00:00Z' }] });
    renderForgePowerView({ powerButton: button, powerLabel: textNode(), powerDetail: textNode() }, { state: 'failed', enabled: true, label: 'Hermes not available', detail: 'Connect Hermes.', action: 'Retry safely' });
    button.click();
    await flushAsync();
    await flushAsync();
    expect(calls.start).toEqual(['goal-1']);
  });

  it('failed retry executes on first click', async () => {
    const { button, calls } = harness({ stored: { efestoForgeEnabled: true }, missions: [{ id: 'old', goalId: 'goal-1', status: 'failed', createdAt: '2026-07-22T19:00:00Z' }] });
    renderForgePowerView({ powerButton: button, powerLabel: textNode(), powerDetail: textNode() }, { state: 'failed', enabled: true, label: 'Research stopped safely', detail: 'Stopped.', action: 'Retry safely' });
    button.click();
    await flushAsync();
    await flushAsync();
    expect(calls.start).toEqual(['goal-1']);
  });
});
