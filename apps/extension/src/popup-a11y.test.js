import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve('apps/extension/src/popup.html'), 'utf8');

function controls(source) {
  const found = [];
  const pattern = /<(input|select|textarea)\b([^>]*)>/gi;
  for (const match of source.matchAll(pattern)) {
    const attrs = match[2];
    const type = /\btype="([^"]+)"/i.exec(attrs)?.[1] ?? '';
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
    found.push({ tag: match[1], attrs, id: /\bid="([^"]+)"/i.exec(attrs)?.[1], index: match.index });
  }
  return found;
}

function hasAccessibleName(source, control) {
  if (/\baria-label="[^"]+"/i.test(control.attrs) || /\baria-labelledby="[^"]+"/i.test(control.attrs)) return true;
  if (control.id && new RegExp(`<label\\b[^>]*\\bfor="${control.id}"`, 'i').test(source)) return true;
  // Wrapped in a <label> that itself carries text or aria-label.
  const before = source.slice(0, control.index);
  const open = before.lastIndexOf('<label');
  const close = before.lastIndexOf('</label>');
  if (open > close) return /aria-label="[^"]+"/i.test(source.slice(open, source.indexOf('>', open)));
  return false;
}

describe('extension popup form controls (mounted popup.html)', () => {
  it('finds the mounted controls', () => {
    const ids = controls(html).map((c) => c.id);
    for (const id of ['pairing-code', 'kernel-token', 'case-target', 'goal-title', 'goal-category', 'goal-location', 'goal-keywords', 'site-radar']) {
      expect(ids).toContain(id);
    }
  });

  it('gives every input/select/textarea an accessible name (placeholder is not a label)', () => {
    const unnamed = controls(html).filter((c) => !hasAccessibleName(html, c)).map((c) => c.id ?? c.tag);
    expect(unnamed).toEqual([]);
  });
});
