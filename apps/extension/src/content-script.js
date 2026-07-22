chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT') return false;

  try {
    const selection = globalThis.getSelection?.()?.toString() ?? '';
    const context = globalThis.HephaestusPageContext.capturePageContext(
      document,
      location,
      selection,
    );
    sendResponse({ ok: true, context });
  } catch (_error) {
    sendResponse({ ok: false, error: 'Unable to capture page context' });
  }

  return false;
});

const announceReady = () => chrome.runtime.sendMessage({ type: 'EFESTO_PUBLIC_PAGE_READY' }).catch(() => undefined);
if (document.readyState === 'complete') announceReady();
else globalThis.addEventListener('load', announceReady, { once: true });
