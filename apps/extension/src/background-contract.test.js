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
    expect(source).toContain("import { chromeNotificationIdForWatchtowerAviso, pendingWorkspaceViewForWatchtowerNotification, presentWatchtowerAviso, reconcileMissionWatchtower } from './mission-watchtower.js'");
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
    expect(source).toContain("iconUrl: 'icons/efesto-notification.png'");
    // Covering: state-agnostic list. Delivery: separate state=unread list so mark-read
    // after OS create advances the unread window (unfiltered limit keeps read in-page).
    expect(source).toContain('listNotifications({ ...options, limit: 40 })');
    expect(source).toContain("state: 'unread'");
    expect(source).toContain('unreadKernelNotifications');
    expect(source).toContain('presentKernelSupportedFindOsNotify(item)');
    expect(source).toContain('await markNotificationRead(item.id, options)');
    expect(source).toContain('stored.deliveredKernelNotifications,');
    expect(source).toContain('options,');
    // Lock-screen privacy: never pass Kernel receipt title/body straight into chrome.notifications.
    expect(source).not.toMatch(/title:\s*item\.title/);
    expect(source).not.toMatch(/message:\s*item\.body/);
  });

  it('routes watchtower Find OS notify click to Finds (not missions-only)', () => {
    expect(source).toContain('chromeNotificationIdForWatchtowerAviso');
    expect(source).toContain('pendingWorkspaceViewForWatchtowerNotification');
    expect(source).toContain('chromeNotificationIdForWatchtowerAviso(transition, aviso.kind)');
    // Bare missions-only click path must not remain for all efesto-mission:* ids.
    expect(source).not.toMatch(/if \(!notificationId\.startsWith\('efesto-mission:'\)\) return;[\s\S]*pendingWorkspaceView: 'missions'/);
  });
});
