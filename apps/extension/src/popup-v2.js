import { createGoal, getKernelStatus, pairKernel } from './local-transport.js';
import { detectPopupLocale, popupT, POPUP_LOCALE_KEY, POPUP_LOCALE_NAMES, POPUP_LOCALES } from './popup-i18n.js';
import { displayHost, goalPayload, hasToken, isAnalyzablePage, kernelBaseFrom } from './popup-v2-logic.js';

const $ = (selector) => document.querySelector(selector);
let locale = 'en';
let tab;
const tr = (key) => popupT(locale, key);

function applyLocale() {
  document.documentElement.lang = locale;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = tr(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', tr(el.dataset.i18nAria));
  const select = $('#language');
  select.replaceChildren(...POPUP_LOCALES.map((code) => { const o = new Option(POPUP_LOCALE_NAMES[code], code, false, code === locale); o.lang = code; return o; }));
}

function setPill(kind) {
  const pill = $('#status-pill');
  pill.className = `pill${kind === 'connected' ? '' : kind === 'offline' ? ' off' : ' wait'}`;
  $('#status-text').textContent = tr(kind);
}

function say(key, bad = false) {
  const m = $('#message');
  m.hidden = false; m.textContent = tr(key); m.classList.toggle('bad', bad);
}

async function showMain(stored) {
  $('#first-run').hidden = true;
  $('#main').hidden = false;
  $('#disconnect').hidden = false;
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  $('#page-title').textContent = tab?.title || '';
  $('#host').textContent = displayHost(tab?.url ?? '');
  if (tab?.favIconUrl && /^https?:|^data:image\//.test(tab.favIconUrl)) $('#host-mark').style.backgroundImage = `url("${tab.favIconUrl.replace(/"/g, '')}")`;
  $('#analyze').disabled = !isAnalyzablePage(tab?.url);
  try { await getKernelStatus({ baseUrl: kernelBaseFrom(stored) }); setPill('connected'); }
  catch { setPill('offline'); }
}

function showFirstRun(failed = false) {
  $('#main').hidden = true;
  $('#first-run').hidden = false;
  $('#first-run').classList.toggle('failed', failed);
  $('#first-title').textContent = tr(failed ? 'offline' : 'first');
  $('#first-sub').textContent = tr(failed ? 'firstFailed' : 'firstSub');
  $('#retry').hidden = !failed;
  setPill(failed ? 'offline' : 'connecting');
  if (failed) $('#advanced').open = true;
}

let pairTimer;
async function startAutoPair() {
  showFirstRun(false);
  clearTimeout(pairTimer);
  const reply = await chrome.runtime.sendMessage({ type: 'EFESTO_AUTO_PAIR_START' }).catch(() => undefined);
  if (!reply?.ok) { showFirstRun(true); return; }
  pairTimer = setTimeout(async () => { const stored = await chrome.storage.local.get(['kernelApiToken']); if (!hasToken(stored)) showFirstRun(true); }, 20_000);
}

async function analyze() {
  if (!tab?.id || !isAnalyzablePage(tab.url)) { say('notPublic', true); return; }
  const button = $('#analyze');
  button.disabled = true; button.textContent = tr('analyzing');
  try {
    const captured = await chrome.tabs.sendMessage(tab.id, { type: 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT' });
    if (!captured?.ok) throw new Error('capture');
    const result = await chrome.runtime.sendMessage({ type: 'HEPHAESTUS_SEND_PAGE_CONTEXT', context: captured.context });
    if (!result?.ok) throw new Error('send');
    say('saved');
  } catch { say('failed', true); }
  finally { button.disabled = false; button.textContent = tr('analyze'); }
}

async function saveGoal(event) {
  event.preventDefault();
  const payload = goalPayload($('#goal').value);
  if (!payload) return;
  try {
    const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
    await createGoal(payload, { baseUrl: kernelBaseFrom(stored), apiToken: stored.kernelApiToken });
    $('#goal').value = '';
    say('goalSaved');
  } catch { say('goalFailed', true); }
}

async function manualPair() {
  const button = $('#pair');
  button.disabled = true; button.textContent = tr('pairing');
  try {
    const stored = await chrome.storage.local.get(['kernelBaseUrl']);
    const baseUrl = kernelBaseFrom(stored);
    const token = await pairKernel($('#pairing-code').value, { baseUrl });
    await chrome.storage.local.set({ kernelApiToken: token, kernelBaseUrl: baseUrl });
    $('#pairing-code').value = '';
  } catch { $('#first-sub').textContent = tr('pairFailed'); say('pairFailed', true); }
  finally { button.disabled = false; button.textContent = tr('pair'); }
}

async function init() {
  const stored = await chrome.storage.local.get(['kernelApiToken', 'kernelBaseUrl', POPUP_LOCALE_KEY]);
  locale = POPUP_LOCALES.includes(stored[POPUP_LOCALE_KEY]) ? stored[POPUP_LOCALE_KEY] : detectPopupLocale(navigator.languages);
  applyLocale();
  $('#language').addEventListener('change', async (event) => { locale = event.target.value; await chrome.storage.local.set({ [POPUP_LOCALE_KEY]: locale }); applyLocale(); const s = await chrome.storage.local.get(['kernelApiToken', 'kernelBaseUrl']); if (hasToken(s)) await showMain(s); else showFirstRun(!$('#retry').hidden); });
  $('#analyze').addEventListener('click', () => void analyze());
  $('#goal-form').addEventListener('submit', (event) => void saveGoal(event));
  $('#pair').addEventListener('click', () => void manualPair());
  $('#retry').addEventListener('click', () => void startAutoPair());
  $('#disconnect').addEventListener('click', async () => { await chrome.storage.local.remove(['kernelApiToken']); showFirstRun(true); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.kernelApiToken) return;
    void chrome.storage.local.get(['kernelApiToken', 'kernelBaseUrl']).then((s) => { if (hasToken(s)) { clearTimeout(pairTimer); void showMain(s); } });
  });
  if (hasToken(stored)) await showMain(stored); else await startAutoPair();
}

void init();
