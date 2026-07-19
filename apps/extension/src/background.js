import { DEFAULT_KERNEL_BASE_URL, sendPageContext } from './local-transport.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'HEPHAESTUS_SEND_PAGE_CONTEXT') return false;

  void (async () => {
    try {
      const stored = await chrome.storage.local.get('kernelBaseUrl');
      const result = await sendPageContext(message.context, {
        baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
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
