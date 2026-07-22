import { DEFAULT_KERNEL_BASE_URL, listAgentMissions, sendPageContext } from './local-transport.js';
import { evaluateAutoCapture } from './auto-capture-policy.js';
import { reconcileMissionWatchtower } from './mission-watchtower.js';

const WATCHTOWER_ALARM = 'efesto-mission-watchtower';

chrome.runtime.onInstalled.addListener(() => void ensureWatchtower());
chrome.runtime.onStartup.addListener(() => void ensureWatchtower());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCHTOWER_ALARM) void inspectMissionTransitions();
});
chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith('efesto-mission:')) return;
  void chrome.storage.local.set({ pendingWorkspaceView: 'missions' });
  void chrome.notifications.clear(notificationId);
  void chrome.action.openPopup().catch(() => undefined);
});
void ensureWatchtower();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EFESTO_PUBLIC_PAGE_READY') {
    void autoCapture(_sender.tab);
    return false;
  }
  if (message?.type !== 'HEPHAESTUS_SEND_PAGE_CONTEXT') return false;

  void (async () => {
    try {
      const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
      const result = await sendPageContext(message.context, {
        baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
        apiToken: stored.kernelApiToken,
        targetCaseId: message.targetCaseId,
      });
      sendResponse(result);
    } catch (error) {
      sendResponse({
        ok: false,
        code: error?.code ?? 'UNKNOWN',
        error: error instanceof Error ? error.message : 'Unable to send page context',
      });
    }
  })();

  return true;
});

async function autoCapture(tab) {
  if (!tab?.id || !tab.url) return;
  const stored = await chrome.storage.local.get([
    'radarEnabled', 'allowedOrigins', 'kernelBaseUrl', 'kernelApiToken', 'lastAutoCaptureByUrl',
  ]);
  if (stored.radarEnabled !== true || !stored.kernelApiToken) return;

  let captured;
  try {
    captured = await chrome.tabs.sendMessage(tab.id, { type: 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT' });
  } catch {
    return;
  }
  if (!captured?.ok) return;
  const previous = stored.lastAutoCaptureByUrl ?? {};
  const decision = evaluateAutoCapture(captured.context, {
    allowedOrigins: stored.allowedOrigins ?? [],
    lastCapturedAt: previous[captured.context.url],
  });
  if (!decision.allowed) return;

  try {
    await sendPageContext({ ...captured.context, url: decision.safeUrl, selection: undefined }, {
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    });
    await chrome.storage.local.set({
      lastAutoCaptureByUrl: { ...previous, [captured.context.url]: Date.now() },
      lastRadarEvent: { status: 'captured', title: captured.context.title, at: Date.now() },
    });
  } catch {
    await chrome.storage.local.set({ lastRadarEvent: { status: 'failed', at: Date.now() } });
  }
}

async function ensureWatchtower() {
  await chrome.alarms.create(WATCHTOWER_ALARM, { periodInMinutes: 1 });
  await inspectMissionTransitions();
}

async function inspectMissionTransitions() {
  const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken', 'missionWatchtower']);
  if (!stored.kernelApiToken) return;
  try {
    const missions = await listAgentMissions({
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    });
    const result = reconcileMissionWatchtower(missions, stored.missionWatchtower);
    await chrome.storage.local.set({ missionWatchtower: result.state });
    for (const transition of result.transitions) await notifyMissionTransition(transition);
  } catch {
    // A sleeping or restarting local Kernel is expected; retain the last observation.
  }
}

async function notifyMissionTransition(transition) {
  const succeeded = transition.status === 'completed';
  await chrome.notifications.create(`efesto-mission:${transition.id}`, {
    type: 'basic',
    iconUrl: 'icons/efesto-notification.svg',
    title: succeeded ? 'Efesto finished forging' : 'Efesto needs your attention',
    message: succeeded
      ? 'A local mission finished. Open Efesto to inspect the Evidence.'
      : 'A local mission stopped safely. Open Efesto to review the Forge Ledger.',
    priority: 1,
  });
}
