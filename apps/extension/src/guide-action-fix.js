const guideAction = document.querySelector('#guide-action');
const setup = document.querySelector('#setup');
const pairingCodeInput = document.querySelector('#pairing-code');

guideAction?.addEventListener('click', async () => {
  const { kernelApiToken } = await chrome.storage.local.get('kernelApiToken');
  if (kernelApiToken) return;

  requestAnimationFrame(() => {
    setup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pairingCodeInput?.focus({ preventScroll: true });
  });
});
