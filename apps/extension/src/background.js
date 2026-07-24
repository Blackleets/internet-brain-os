import { DEFAULT_KERNEL_BASE_URL, listAgentMissions, sendPageContext } from './local-transport.js';
import { evaluateAutoCapture } from './auto-capture-policy.js';
import { reconcileMissionWatchtower } from './mission-watchtower.js';
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

  // Mensaje especial para controlar el Auto Radar
  if (message?.type === 'EFESTO_AUTO_RADAR_TOGGLE') {
    void (async () => {
      const newState = !autoRadar.enabled;
      await autoRadar.setEnabled(newState);
      sendResponse({ ok: true, enabled: newState });
    })();
    return true; // Mantener el canal de mensaje abierto para la respuesta asincrónica
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

// Mensajes especiales para controlar el Auto Radar
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        kernelBaseUrl: autoRadar.kernelBaseUrl
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
      if (message.allowedOrigins !== undefined) {
        autoRadar.allowedOrigins = message.allowedOrigins;
      }
      if (message.kernelBaseUrl !== undefined) {
        autoRadar.kernelBaseUrl = message.kernelBaseUrl;
      }
      if (message.kernelApiToken !== undefined) {
        autoRadar.kernelApiToken = message.kernelApiToken;
      }
      await autoRadar.saveState();
      sendResponse({ ok: true });
    })();
    return true;
  }
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
      targetCaseId: message?.targetCaseId,
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