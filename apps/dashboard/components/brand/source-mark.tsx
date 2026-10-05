'use client';

import { useState } from 'react';

// Reviewed local assets only. Rendering a source never contacts that source or
// a favicon service, and an icon never grants SUPPORT or source trust.
const SOURCE_MARKS: Readonly<Record<string, string>> = Object.freeze({
  'github.com': '/brand/sources/github.png',
  'www.github.com': '/brand/sources/github.png',
  'code.visualstudio.com': '/brand/sources/vscode.png',
  'hermes-agent.nousresearch.com': '/brand/sources/hermes.ico',
});

export function sourceMark(url: string): { asset?: string; initials: string } {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return { initials: '?' };
    const host = parsed.hostname.toLowerCase();
    const initials = host.replace(/^www\./, '').replace(/[^a-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
    return { asset: Object.hasOwn(SOURCE_MARKS, host) ? SOURCE_MARKS[host] : undefined, initials };
  } catch {
    return { initials: '?' };
  }
}

/** Decorative identity beside the already accessible source name. */
export function SourceMark({ url }: { url: string }) {
  const mark = sourceMark(url);
  const [failedAsset, setFailedAsset] = useState<string>();
  return <span className="efesto-source-mark" aria-hidden="true">
    {mark.asset && failedAsset !== mark.asset
      // Native img loads a bundled asset; no remote optimizer or network fallback.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={mark.asset} alt="" width={20} height={20} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedAsset(mark.asset)} />
      : <span>{mark.initials}</span>}
  </span>;
}
