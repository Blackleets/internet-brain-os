import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  captureFailureMessage,
  isMissingReceiverMessage,
  isSupportedPublicPage,
  PROTECTED_PAGE_COPY,
  RELOAD_PAGE_COPY,
} from './page-support.js';

const RAW = 'Could not establish connection. Receiving end does not exist.';

describe('extension popup page support (mounted capture flow)', () => {
  it('accepts normal public http(s) pages', () => {
    expect(isSupportedPublicPage('https://example.com/article')).toBe(true);
    expect(isSupportedPublicPage('http://news.example.org/')).toBe(true);
    expect(isSupportedPublicPage('https://google.com/search?q=chrome')).toBe(true);
    expect(isSupportedPublicPage('https://chrome.google.com/other')).toBe(true);
  });

  it('rejects browser-protected pages where content scripts never run', () => {
    for (const url of [
      'chrome://settings', 'chrome-extension://abc/src/popup.html', 'file:///tmp/a.html', 'about:blank', 'edge://newtab',
      'https://chromewebstore.google.com/detail/foo/abc',
      'https://chrome.google.com/webstore/detail/foo',
      'https://microsoftedge.microsoft.com/addons/detail/foo',
      'not a url', undefined, null, 42,
    ]) expect(isSupportedPublicPage(url), String(url)).toBe(false);
  });

  it('recognises Chrome missing-receiver errors', () => {
    expect(isMissingReceiverMessage(RAW)).toBe(true);
    expect(isMissingReceiverMessage('Local Kernel rejected the page')).toBe(false);
    expect(isMissingReceiverMessage(undefined)).toBe(false);
  });

  it('never echoes the raw missing-receiver error after a capture attempt', () => {
    // Tab opened before install/reload: content script absent on a public page.
    expect(captureFailureMessage(new Error(RAW), 'https://example.com/')).toBe(RELOAD_PAGE_COPY);
    // Chrome Web Store: protected, reload would not help.
    expect(captureFailureMessage(new Error(RAW), 'https://chromewebstore.google.com/detail/x')).toBe(PROTECTED_PAGE_COPY);
    expect(captureFailureMessage(new Error(RAW), undefined)).toBe(PROTECTED_PAGE_COPY);
    expect(captureFailureMessage(new Error(RAW), 'https://example.com/')).not.toContain('Receiving end');
  });

  it('keeps other capture failures verbatim with a safe fallback', () => {
    expect(captureFailureMessage(new Error('Local Kernel rejected the page'), 'https://example.com/')).toBe('Local Kernel rejected the page');
    expect(captureFailureMessage(undefined, 'https://example.com/')).toBe('Unable to analyze page');
    expect(captureFailureMessage(new Error(''), 'https://example.com/')).toBe('Unable to analyze page');
  });

  it('wires popup capture and the unsupported-page guard through page-support', () => {
    const popup = readFileSync(resolve('apps/extension/src/popup.js'), 'utf8');
    const guard = readFileSync(resolve('apps/extension/src/unsupported-page-guard.js'), 'utf8');
    expect(popup).toContain("import { captureFailureMessage } from './page-support.js';");
    expect(popup).toContain('setStatus(captureFailureMessage(error, tab?.url), true)');
    expect(popup).not.toContain("setStatus(error instanceof Error ? error.message : 'Unable to analyze page', true)");
    expect(guard).toContain("from './page-support.js'");
    expect(guard).toContain('status.textContent = PROTECTED_PAGE_COPY');
  });
});
