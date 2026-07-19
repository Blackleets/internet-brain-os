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
