import { DEFAULT_KERNEL_BASE_URL, listCases } from './local-transport.js';

const select = document.querySelector('#case-target');
const button = document.querySelector('#capture');
const status = document.querySelector('#status');

void loadCases();
button.addEventListener('click', capture);

async function loadCases() {
  try {
    const stored = await chrome.storage.local.get('kernelBaseUrl');
    const cases = await listCases({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL });
    for (const item of cases) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      select.append(option);
    }
  } catch {
    setStatus('Start the local Kernel to load existing Cases.', true);
  }
}

async function capture() {
  button.disabled = true;
  setStatus('Forging Evidence…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active page');
    const captured = await chrome.tabs.sendMessage(tab.id, { type: 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT' });
    if (!captured?.ok) throw new Error('Unable to read this page');
    const result = await chrome.runtime.sendMessage({
      type: 'HEPHAESTUS_SEND_PAGE_CONTEXT',
      context: captured.context,
      targetCaseId: select.value || undefined,
    });
    if (!result?.ok) throw new Error(result?.error ?? 'Local Kernel rejected the page');
    const destination = select.value ? 'Evidence added to the selected Case.' : 'New Case and Evidence created.';
    setStatus(`${destination}${result.obsidianUpdated ? ' Obsidian notes updated.' : ''}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to capture page', true);
  } finally {
    button.disabled = false;
  }
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
