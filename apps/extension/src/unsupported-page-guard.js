import { isMissingReceiverMessage, isSupportedPublicPage, PROTECTED_PAGE_COPY } from './page-support.js';

const captureButton = document.querySelector('#capture');
const siteRadar = document.querySelector('#site-radar');
const siteName = document.querySelector('#site-name');
const radarCopy = document.querySelector('#radar-copy');
const status = document.querySelector('#status');

void initializeUnsupportedPageGuard();

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#capture') && captureButton?.disabled) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showUnsupportedPageState();
  }
}, true);

async function initializeUnsupportedPageGuard() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { tab = undefined; }
  if (isSupportedPublicPage(tab?.url)) return;
  showUnsupportedPageState();
}

function showUnsupportedPageState() {
  if (captureButton) {
    captureButton.disabled = true;
    captureButton.title = 'Open a normal public website to analyze it.';
  }
  if (siteRadar) siteRadar.disabled = true;
  if (siteName) siteName.textContent = 'Browser page';
  if (radarCopy) radarCopy.textContent = 'Efesto does not analyze Chrome settings, extension pages, local files, or other protected browser pages.';
  if (status && isMissingReceiverMessage(status.textContent)) {
    status.textContent = PROTECTED_PAGE_COPY;
    status.classList.remove('error');
  }
}

export { isMissingReceiverMessage, isSupportedPublicPage };
