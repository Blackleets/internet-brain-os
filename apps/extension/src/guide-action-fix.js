export function pairingReadinessView(hasToken) {
  return hasToken
    ? { label: 'KERNEL READY', ready: true, status: '' }
    : { label: 'PAIR KERNEL', ready: false, status: 'Kernel found. Enter the one-time pairing code below to authorize this extension.' };
}

const doc = globalThis.document;
const guideAction = doc?.querySelector?.('#guide-action');
const setup = doc?.querySelector?.('#setup');
const pairingCodeInput = doc?.querySelector?.('#pairing-code');
const kernelState = doc?.querySelector?.('#kernel-state');
const status = doc?.querySelector?.('#status');

async function syncPairingReadiness() {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage || !kernelState) return;
  const { kernelApiToken } = await storage.get('kernelApiToken');
  const view = pairingReadinessView(Boolean(kernelApiToken));
  kernelState.textContent = view.label;
  kernelState.classList.toggle('ready', view.ready);
  if (!view.ready && status && !status.textContent) status.textContent = view.status;
}

guideAction?.addEventListener('click', async () => {
  const { kernelApiToken } = await chrome.storage.local.get('kernelApiToken');
  if (kernelApiToken) return;

  requestAnimationFrame(() => {
    setup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pairingCodeInput?.focus({ preventScroll: true });
  });
});

globalThis.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
  if (area === 'local' && changes.kernelApiToken) void syncPairingReadiness();
});

void syncPairingReadiness();
