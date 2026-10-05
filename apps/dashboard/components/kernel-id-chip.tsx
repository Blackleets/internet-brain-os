'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';
import { shortKernelId } from '../lib/finds/find-copy';

/**
 * A Kernel id as a compact chip: kind + first 8 hex chars, the full id in the title and for screen
 * readers, and a copy button for the full id. `onOpen` turns the label into a button (e.g. open Case).
 */
export function KernelIdChip({ id, onOpen }: { id: string; onOpen?: () => void }) {
  const { kind, short, full } = shortKernelId(id);
  const [copied, setCopied] = useState(false);
  const label = <><span className="kid-kind">{kind}</span><span className="kid-short">{short}</span><span className="forge-sr-only">{` (id completo ${full})`}</span></>;
  const copy = () => {
    void navigator.clipboard?.writeText(full).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }).catch(() => {});
  };
  return <span className="kernel-id-chip" title={full} data-id={full}>
    {onOpen ? <button type="button" className="kid-open" onClick={onOpen}>{label}</button> : <span className="kid-label">{label}</span>}
    <button type="button" className="kid-copy" onClick={copy} aria-label={copied ? 'Id copiado' : `Copiar id completo ${full}`}>
      <Copy aria-hidden="true" />{copied ? <span className="kid-copied">copiado</span> : null}
    </button>
  </span>;
}
