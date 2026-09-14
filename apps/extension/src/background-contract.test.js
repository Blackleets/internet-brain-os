import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./background.js', import.meta.url), 'utf8');

describe('extension background runtime contract', () => {
  it('registers a single runtime message listener so commands are handled once', () => {
    expect(source.match(/chrome\.runtime\.onMessage\.addListener/g) ?? []).toHaveLength(1);
    expect(source.match(/message\?\.type === 'EFESTO_AUTO_RADAR_TOGGLE'/g) ?? []).toHaveLength(1);
  });

  it('keeps legacy auto-capture independent from popup-only message scope', () => {
    const start = source.indexOf('async function autoCapture');
    const end = source.indexOf('async function ensureWatchtower', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const autoCaptureSource = source.slice(start, end);
    expect(autoCaptureSource).not.toContain('message?.targetCaseId');
    expect(autoCaptureSource).toContain('sendPageContext');
  });

  it('fail-closes OS notify Find/Completado aviso through presentWatchtowerAviso', () => {
    expect(source).toContain("import { presentWatchtowerAviso, reconcileMissionWatchtower } from './mission-watchtower.js'");
    expect(source).toContain('listOpportunities');
    expect(source).toContain('presentWatchtowerAviso(transition, opportunities, mission)');
    expect(source).toContain('shouldOsNotifyWatchtowerAviso(aviso, { coveringKernelFindNotifications: covering })');
    expect(source).not.toContain("title: forged ? 'Efesto finished forging'");
  });

  it('delivers Kernel NotificationGateway SUPPORT Find receipts (half-built path closed)', () => {
    expect(source).toContain('listNotifications');
    expect(source).toContain('markNotificationRead');
    expect(source).toContain('deliverKernelSupportedFindNotifications');
    expect(source).toContain('undeliveredKernelSupportedFindNotifications');
    expect(source).toContain('kernelFindsCoveringMission');
    expect(source).toContain('chromeNotificationIdForKernelNotification');
    expect(source).toContain("pendingWorkspaceView: 'finds'");
  });
});
