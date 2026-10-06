// Discovery carries only the public extension ID. Never credentials or Kernel data.
(() => {
  if (location.origin !== 'https://efesto-five.vercel.app' || window !== window.top) return;
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'EFESTO_DISCOVER') return;
    const nonce = event.data.nonce;
    if (typeof nonce !== 'string' || nonce.length > 80) return;
    window.postMessage({ type: 'EFESTO_EXTENSION', nonce, extensionId: chrome.runtime.id }, location.origin);
  });
})();
