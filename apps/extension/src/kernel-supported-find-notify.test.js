import { describe, expect, it } from 'vitest';
import {
  chromeNotificationIdForKernelNotification,
  kernelFindsCoveringMission,
  parseKernelNotificationId,
  presentKernelSupportedFindOsNotify,
  rememberDeliveredKernelNotificationIds,
  selectKernelSupportedFindCoveringNotifications,
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

  it('keeps covering after mark-read so watchtower cannot double-fire Find', () => {
    const supportedRead = { ...supportedUnread, state: 'read' };
    const supportedDismissed = { ...supportedUnread, id: 'notification:dismissed', state: 'dismissed' };
    const mission = {
      verificationResults: [{ evidenceId: 'evidence:supported', supported: true }],
    };
    // Delivery stays unread-only (no minute re-spam after click → markNotificationRead).
    expect(selectKernelSupportedFindNotifications([supportedRead, supportedDismissed])).toEqual([]);
    expect(undeliveredKernelSupportedFindNotifications([supportedRead], [])).toEqual([]);
    // Covering must still see the Kernel SUPPORT receipt after mark-read / dismiss.
    expect(selectKernelSupportedFindCoveringNotifications([supportedRead])).toEqual([supportedRead]);
    expect(kernelFindsCoveringMission([supportedRead], mission)).toEqual([supportedRead]);
    expect(kernelFindsCoveringMission([supportedDismissed], mission)).toEqual([supportedDismissed]);
    expect(
      shouldOsNotifyWatchtowerAviso(
        { notify: true, kind: 'find' },
        { coveringKernelFindNotifications: kernelFindsCoveringMission([supportedRead], mission) },
      ),
    ).toBe(false);
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
  it('suppresses find and forged when Kernel covering Find receipts exist', () => {
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'find' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(false);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'find' }, { coveringKernelFindNotifications: [] })).toBe(true);
    // Opportunities empty / failed → kind forged, but covering still proves Kernel Finds.
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'forged' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(false);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'forged' }, { coveringKernelFindNotifications: [] })).toBe(true);
    expect(shouldOsNotifyWatchtowerAviso({ notify: true, kind: 'attention' }, { coveringKernelFindNotifications: [supportedUnread] })).toBe(true);
    expect(shouldOsNotifyWatchtowerAviso({ notify: false, kind: 'find' })).toBe(false);
  });

  it('covers opportunities-empty forged path after Kernel already OS-notified Find', () => {
    const mission = {
      verificationResults: [{ evidenceId: 'evidence:supported', supported: true }],
    };
    const covering = kernelFindsCoveringMission([supportedUnread], mission);
    expect(covering).toEqual([supportedUnread]);
    // Mirrors background.js when listOpportunities throws → opportunities=[] → kind forged.
    expect(
      shouldOsNotifyWatchtowerAviso(
        { notify: true, kind: 'forged', title: 'Efesto finished forging' },
        { coveringKernelFindNotifications: covering },
      ),
    ).toBe(false);
  });
});

describe('presentKernelSupportedFindOsNotify', () => {
  it('uses generic lock-screen-safe copy — never Find titles or bodies', () => {
    // Receipt title/body may name the researched item; OS notify must not leak it.
    expect(presentKernelSupportedFindOsNotify(supportedUnread)).toEqual({
      title: 'Efesto finished forging',
      message: 'A Find passed Kernel SUPPORT. Open Efesto to inspect.',
    });
    expect(presentKernelSupportedFindOsNotify(supportedUnread).title).not.toBe(supportedUnread.title);
    expect(presentKernelSupportedFindOsNotify(supportedUnread).message).not.toContain('Quality drill');
    expect(presentKernelSupportedFindOsNotify({}).message).toMatch(/Kernel SUPPORT/);
  });
});
