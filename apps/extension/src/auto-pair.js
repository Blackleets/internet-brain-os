// No-code first run: the extension pairs with the Efesto running on this computer.
//
// Flow: popup asks the background to start → the background makes sure the local dashboard is open
// (http://127.0.0.1:3311, served next to the Kernel) → our content script on that page asks the page
// for a pairing code → the dashboard mints a one-use, two-minute code through its server-side Kernel
// bridge (POST /api/pairing/extension-code, #285) → the content script hands the code to the
// background → the background redeems it at the Kernel's /pair, exactly like a typed code.
//
// The Kernel token never travels through the page: only the short-lived code does, and only our own
// content script on the loopback dashboard origin may hand one over.
import { pairKernel } from './local-transport.js';

export const LOCAL_DASHBOARD_ORIGINS = Object.freeze(['http://127.0.0.1:3311', 'http://localhost:3311']);
export const LOCAL_DASHBOARD_URL = `${LOCAL_DASHBOARD_ORIGINS[0]}/`;
export const PAIR_PAGE_REQUEST = 'efesto-extension:pair-request';
export const PAIR_PAGE_CODE = 'efesto-dashboard:pair-code';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function isLocalDashboardUrl(value) {
  try { return LOCAL_DASHBOARD_ORIGINS.includes(new URL(value).origin); } catch { return false; }
}

/** Only our own content script, in the top frame of the local dashboard, may hand over a code. */
export function isDashboardContentSender(sender, runtimeId) {
  return Boolean(runtimeId && sender?.id === runtimeId && Number.isInteger(sender?.tab?.id)
    && sender?.frameId === 0 && sender?.tab?.incognito !== true && isLocalDashboardUrl(sender?.url));
}

/** Loopback http origin only (the Kernel never lives anywhere else). */
export function loopbackKernelOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return undefined;
    if (url.username || url.password) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export function validPairingCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

/** Redeems a dashboard-issued code. Returns the stored connection or throws a coded error. */
export async function redeemDashboardCode({ code, kernelUrl }, chromeApi, deps = {}) {
  if (!validPairingCode(code)) throw Object.assign(new Error('Invalid pairing code'), { code: 'INVALID_PAIRING_CODE' });
  const baseUrl = loopbackKernelOrigin(kernelUrl);
  if (!baseUrl) throw Object.assign(new Error('Kernel must be on this computer'), { code: 'NON_LOOPBACK_KERNEL' });
  const token = await (deps.pairKernel ?? pairKernel)(code, { baseUrl, fetchImpl: deps.fetchImpl });
  await chromeApi.storage.local.set({ kernelApiToken: token, kernelBaseUrl: baseUrl });
  return { ok: true, baseUrl };
}

/** Opens the local dashboard in the background if it is not already open (no focus stealing). */
export async function ensureDashboardOpen(chromeApi) {
  const tabs = await chromeApi.tabs.query({ url: LOCAL_DASHBOARD_ORIGINS.map((origin) => `${origin}/*`) }).catch(() => []);
  if (tabs.length) { if (Number.isInteger(tabs[0].id)) await chromeApi.tabs.reload(tabs[0].id).catch(() => undefined); return { opened: false }; }
  await chromeApi.tabs.create({ url: LOCAL_DASHBOARD_URL, active: false });
  return { opened: true };
}

export function installAutoPair(chromeApi, deps = {}) {
  chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
    const runtimeId = chromeApi.runtime.id;
    if (message?.type === 'EFESTO_AUTO_PAIR_STATUS') {
      if (!isDashboardContentSender(sender, runtimeId)) { respond({ ok: false, code: 'FORBIDDEN_SENDER' }); return false; }
      void chromeApi.storage.local.get(['kernelApiToken']).then((stored) => respond({ ok: true, needsPairing: !(typeof stored.kernelApiToken === 'string' && stored.kernelApiToken.length >= 32) }));
      return true;
    }
    if (message?.type === 'EFESTO_PAIR_WITH_CODE') {
      if (!isDashboardContentSender(sender, runtimeId)) { respond({ ok: false, code: 'FORBIDDEN_SENDER' }); return false; }
      void redeemDashboardCode(message, chromeApi, deps)
        .then((result) => respond(result))
        .catch((error) => respond({ ok: false, code: error?.code ?? 'PAIRING_FAILED' }));
      return true;
    }
    if (message?.type === 'EFESTO_AUTO_PAIR_START') {
      const page = typeof sender?.url === 'string' && sender.url.startsWith(`chrome-extension://${runtimeId}/`) && !sender.tab && sender.id === runtimeId;
      if (!page) { respond({ ok: false, code: 'FORBIDDEN_SENDER' }); return false; }
      void ensureDashboardOpen(chromeApi).then((result) => respond({ ok: true, ...result })).catch(() => respond({ ok: false, code: 'DASHBOARD_UNAVAILABLE' }));
      return true;
    }
    return false;
  });
}
