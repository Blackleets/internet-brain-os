import { describe, expect, it } from 'vitest';
import {
  chromeNotificationIdForKernelNotification,
  kernelFindsCoveringMission,
  parseKernelNotificationId,
  presentKernelSupportedFindOsNotify,
  rememberDeliveredKernelNotificationIds,
  selectKernelSupportedFindNotifications,
  shouldOsNotifyWatchtowerAviso,
  undeliveredKernelSupportedFindNotifications,
} from './kernel-supported-find-notify.js';

const supportedUnread = {
  id: 'notification:abc',
  state: 'unread',
  sourceType: 'opportunity',
  sourceId: 'opportunity:supported',
  dedupeKey: 'find:supported:opportunity:supported',
  evidenceIds: ['evidence:supported'],
  title: 'Quality drill 24.99 EUR',
  body: 'Quality drill 24.99 EUR passed Kernel SUPPORT. Evidence retained — open Efesto to inspect.',
};

describe('selectKernelSupportedFindNotifications', () => {
  it('admits only unread Kernel SUPPORT Find receipts', () => {
    const selected = selectKernelSupportedFindNotifications([
      supportedUnread,
      { ...supportedUnread, id: 'notification:read', state: 'read' },
      {
        id: 'notification:mission',
        state: 'unread',
        sourceType: 'mission',
        dedupeKey: 'mission:forged:1',
        evidenceIds: ['evidence:x'],
        title: 'Mission finished',
      },
      {
        id: 'notification:no-evidence',
        state: 'unread',
        sourceType: 'opportunity',
        dedupeKey: 'find:supported:opportunity:bare',
        title: 'Bare lead',
      },
      {
        id: 'notification:wrong-dedupe',
        state: 'unread',
        sourceType: 'opportunity',
        dedupeKey: 'opportunity:promoted:1',
        evidenceIds: ['evidence:x'],
        title: 'Promoted without SUPPORT key',
      },
      null,
      'bad',
    ]);
    expect(selected).toEqual([supportedUnread]);
  });

  it('fail-closes empty and malformed lists', () => {
    expect(selectKernelSupportedFindNotifications(undefined)).toEqual([]);
    expect(selectKernelSupportedFindNotifications({})).toEqual([]);
  });
});

describe('delivery dedupe', () => {
  it('skips Kernel receipts already delivered locally', () => {
    expect(undeliveredKernelSupportedFindNotifications([supportedUnread], ['notification:abc'])).toEqual([]);
    expect(undeliveredKernelSupportedFindNotifications([supportedUnread], [])).toEqual([supportedUnread]);
    expect(rememberDeliveredKernelNotificationIds(['notification:old'], ['notification:abc'])).toEqual([
      'notification:abc',
      'notification:old',
    ]);
  });
});

describe('kernelFindsCoveringMission', () => {
  it('matches only SUPPORT evidence rows for this mission', () => {
    const mission = {
      verificationResults: [
        { evidenceId: 'evidence:supported', supported: true },
        { evidenceId: 'evidence:other', supported: false },
      ],
    };
    expect(kernelFindsCoveringMission([supportedUnread], mission)).toEqual([supportedUnread]);
    expect(kernelFindsCoveringMission([supportedUnread], { verificationResults: [] })).toEqual([]);
  });
});

describe('chrome notification id round-trip', () => {
  it('encodes and parses Kernel notification ids', () => {
    const chromeId = chromeNotificationIdForKernelNotification('notification:abc');
    expect(chromeId).toBe('efesto-kernel-notification:notification:abc');
    expect(parseKernelNotificationId(chromeId)).toBe('notification:abc');
    expect(parseKernelNotificationId('efesto-mission:1')).toBeNull();
    expect(parseKernelNotificationId('efesto-kernel-notification:')).toBeNull();
  });
});

describe('shouldOsNotifyWatchtowerAviso', () => {
  it('suppresses find avisos only when Kernel covering Find receipts exist', () => {
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'find' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(false);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'find' }, { coveringKernelFindNotifications: [] })).toBe(true);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'failed' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(true);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'forged' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(true);
    expect(shouldOsNotifyWatchtowerAviso({ notify: false, kind: 'find' })).toBe(false);
  });
});

describe('presentKernelSupportedFindOsNotify', () => {
  it('keeps Kernel SUPPORT copy bounded for chrome.notifications', () => {
    expect(presentKernelSupportedFindOsNotify(supportedUnread)).toEqual({
      title: 'Quality drill 24.99 EUR',
      message: supportedUnread.body,
    });
    expect(presentKernelSupportedFindOsNotify({}).title).toContain('Kernel SUPPORT');
  });
});
