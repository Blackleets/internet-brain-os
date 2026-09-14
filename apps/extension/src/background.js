import { DEFAULT_KERNEL_BASE_URL, listAgentMissions, listNotifications, listOpportunities, markNotificationRead, sendPageContext } from './local-transport.js';
import { evaluateAutoCapture } from './auto-capture-policy.js';
import { presentWatchtowerAviso, reconcileMissionWatchtower } from './mission-watchtower.js';
import {
  chromeNotificationIdForKernelNotification,
  kernelFindsCoveringMission,
  parseKernelNotificationId,
  presentKernelSupportedFindOsNotify,
  rememberDeliveredKernelNotificationIds,
  shouldOsNotifyWatchtowerAviso,
  undeliveredKernelSupportedFindNotifications,
} from './kernel-supported-find-notify.js';
import { AutoRadar, AUTO_RADAR_STATES } from './auto-radar.js';

const WATCHTOWER_ALARM = 'efesto-mission-watchtower';

// Instancia global del Auto Radar
const autoRadar = new AutoRadar();

chrome.runtime.onInstalled.addListener(() => void ensureWatchtower());
chrome.runtime.onStartup.addListener(() => void ensureWatchtower());
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === WATCHTOWER_ALARM) {
    try {
      await inspectMissionTransitions();
      await autoRadar.processQueue();
    } catch (error) {
      console.error('Error in watchtower alarm handler:', error);
    }
  }
});
chrome.notifications.onClicked.addListener((notificationId) => {
  const kernelNotificationId = parseKernelNotificationId(notificationId);
  if (kernelNotificationId) {
    void (async () => {
      const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
      if (stored.kernelApiToken) {
        try {
          await markNotificationRead(kernelNotificationId, {
            baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
            apiToken: stored.kernelApiToken,
          });
        } catch {
          // Local Kernel may be asleep; still open the Finds workspace.
        }
      }
      await chrome.storage.local.set({ pendingWorkspaceView: 'finds' });
      void chrome.notifications.clear(notificationId);
      void chrome.action.openPopup().catch(() => undefined);
    })();
    return;
  }
  if (!notificationId.startsWith('efesto-mission:')) return;
  void chrome.storage.local.set({ pendingWorkspaceView: 'missions' });
  void chrome.notifications.clear(notificationId);
  void chrome.action.openPopup().catch(() => undefined);
});
void ensureWatchtower();

// Manejar mensajes de contenido y popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Mensaje del content script indicando que la página está lista
  if (message?.type === 'EFESTO_PUBLIC_PAGE_READY') {
    // Si el Auto Radar está habilitado, usar el análisis automático
    if (autoRadar.enabled && autoRadar.state !== AUTO_RADAR_STATES.PAUSED) {
      void autoRadar.analyzePage(_sender.tab);
      return false; // No necesitamos responder, el Auto Radar lo maneja
    }
    // Si no, usar el método manual existente (compatibilidad hacia atrás)
    void autoCapture(_sender.tab);
    return false;
  }

  // Mensajes especiales para controlar el Auto Radar
  if (message?.type === 'EFESTO_AUTO_RADAR_TOGGLE') {
    void (async () => {
      const newState = !autoRadar.enabled;
      await autoRadar.setEnabled(newState);
      sendResponse({ ok: true, enabled: newState });
    })();
    return true;
  }

  if (message?.type === 'EFESTO_AUTO_RADAR_GET_STATE') {
    void (async () => {
      sendResponse({
        ok: true,
        enabled: autoRadar.enabled,
        state: autoRadar.state,
        allowedOrigins: autoRadar.allowedOrigins,
        kernelBaseUrl: autoRadar.kernelBaseUrl,
      });
    })();
    return true;
  }

  if (message?.type === 'EFESTO_AUTO_RADAR_SET_STATE') {
    void (async () => {
      await autoRadar.setState(message.state);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === 'EFESTO_AUTO_RADAR_UPDATE_CONFIG') {
    void (async () => {
      if (message.allowedOrigins !== undefined) autoRadar.allowedOrigins = message.allowedOrigins;
      if (message.kernelBaseUrl !== undefined) autoRadar.kernelBaseUrl = message.kernelBaseUrl;
      if (message.kernelApiToken !== undefined) autoRadar.kernelApiToken = message.kernelApiToken;
      await autoRadar.saveState();
      sendResponse({ ok: true });
    })();
    return true;
  }

  // Mensaje del popup para enviar contexto de página (manual)
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
  const stored = await chrome.storage.local.get([
    'kernelBaseUrl', 'kernelApiToken', 'missionWatchtower', 'deliveredKernelNotifications',
  ]);
  if (!stored.kernelApiToken) return;
  try {
    const options = {
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    };
    const missions = await listAgentMissions(options);
    let opportunities = [];
    try {
      opportunities = await listOpportunities(options);
    } catch {
      opportunities = [];
    }
    // Close the half-built Kernel NotificationGateway path: deliver unread SUPPORT Find
    // receipts as OS notifies (no new UI). Watchtower remains fallback when gateway fails.
    // Fetch without state=unread so covering still sees mark-read receipts on a later
    // watchtower revision transition (delivery itself stays unread-only via select*).
    let kernelNotifications = [];
    try {
      kernelNotifications = await listNotifications({ ...options, limit: 40 });
      await deliverKernelSupportedFindNotifications(
        kernelNotifications,
        stored.deliveredKernelNotifications,
      );
    } catch {
      kernelNotifications = [];
    }
    const result = reconcileMissionWatchtower(missions, stored.missionWatchtower);
    await chrome.storage.local.set({ missionWatchtower: result.state });
    const byId = Object.fromEntries(missions.filter((mission) => typeof mission?.id === 'string').map((mission) => [mission.id, mission]));
    for (const transition of result.transitions) {
      const mission = byId[transition.missionId];
      const aviso = presentWatchtowerAviso(transition, opportunities, mission);
      const covering = kernelFindsCoveringMission(kernelNotifications, mission);
      if (shouldOsNotifyWatchtowerAviso(aviso, { coveringKernelFindNotifications: covering })) {
        await notifyMissionTransition(transition, aviso);
      }
    }
  } catch {
    // A sleeping or restarting local Kernel is expected; retain the last observation.
  }
}

async function deliverKernelSupportedFindNotifications(notifications, deliveredIds) {
  const selected = undeliveredKernelSupportedFindNotifications(notifications, deliveredIds);
  if (!selected.length) return false;
  for (const item of selected) {
    const copy = presentKernelSupportedFindOsNotify(item);
    await chrome.notifications.create(chromeNotificationIdForKernelNotification(item.id), {
      type: 'basic',
      iconUrl: 'icons/efesto-notification.png',
      title: copy.title,
      message: copy.message,
      priority: 1,
    });
  }
  await chrome.storage.local.set({
    deliveredKernelNotifications: rememberDeliveredKernelNotificationIds(
      deliveredIds,
      selected.map((item) => item.id),
    ),
  });
  return true;
}

async function notifyMissionTransition(transition, aviso) {
  await chrome.notifications.create(`efesto-mission:${transition.id}`, {
    type: 'basic',
    iconUrl: 'icons/efesto-notification.png',
    title: aviso.title,
    message: aviso.message,
    priority: 1,
  });
}
