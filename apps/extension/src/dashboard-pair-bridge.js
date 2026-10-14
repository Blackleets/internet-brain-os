// Content script on the LOCAL dashboard only (manifest match: 127.0.0.1:3311 / localhost:3311).
// Asks the page for a one-use pairing code when the extension is not paired yet and hands it to
// our background. Never sees the Kernel token.
(() => {
  const REQUEST = 'efesto-extension:pair-request';
  const REPLY = 'efesto-dashboard:pair-code';
  const nonce = crypto.getRandomValues(new Uint32Array(4)).join('-');
  let done = false;
  let attempts = 0;
  window.addEventListener('message', (event) => {
    if (done || event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== REPLY || data.nonce !== nonce || typeof data.code !== 'string') return;
    done = true;
    chrome.runtime.sendMessage({ type: 'EFESTO_PAIR_WITH_CODE', code: data.code, kernelUrl: data.kernelUrl });
  });
  const ask = () => {
    if (done || attempts >= 10) return;
    attempts += 1;
    window.postMessage({ type: REQUEST, nonce }, location.origin);
    setTimeout(ask, 1500);
  };
  chrome.runtime.sendMessage({ type: 'EFESTO_AUTO_PAIR_STATUS' }, (reply) => {
    if (chrome.runtime.lastError || !reply?.ok || !reply.needsPairing) return;
    ask();
  });
})();
