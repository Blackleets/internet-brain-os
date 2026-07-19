(() => {
  const MAX_TEXT = 12000;
  const MAX_SELECTION = 2000;
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const truncate = (value, max) => {
    const normalized = clean(value);
    return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
  };
  const meta = (document, selector) => document.querySelector(selector)?.getAttribute('content') ?? '';

  function capturePageContext(document, location, selectionText = '', now = () => new Date().toISOString()) {
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    return {
      schemaVersion: 'hephaestus.page-context.v1',
      url: String(location.href),
      title: truncate(document.title, 300),
      canonicalUrl: canonical ? new URL(canonical, location.href).href : undefined,
      description: truncate(meta(document, 'meta[name="description"]') || meta(document, 'meta[property="og:description"]'), 1000) || undefined,
      language: clean(document.documentElement?.lang) || undefined,
      visibleText: truncate(document.body?.innerText ?? '', MAX_TEXT),
      selection: truncate(selectionText, MAX_SELECTION) || undefined,
      capturedAt: now(),
    };
  }

  globalThis.HephaestusPageContext = Object.freeze({ capturePageContext, MAX_TEXT, MAX_SELECTION });
})();
