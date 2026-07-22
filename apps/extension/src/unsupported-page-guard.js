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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    status.textContent = 'Open a normal public website to use page analysis. Missions, Finds, Hermes, and Obsidian remain available.';
    status.classList.remove('error');
  }
}

export function isSupportedPublicPage(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isMissingReceiverMessage(message) {
  return typeof message === 'string' && (
    message.includes('Receiving end does not exist')
    || message.includes('Could not establish connection')
  );
}
