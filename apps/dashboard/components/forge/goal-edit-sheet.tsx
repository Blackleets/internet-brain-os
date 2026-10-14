'use client';

import { t } from '../../lib/i18n';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import { keywordsFromGoal } from '../../lib/kernel/goal-keywords';

export type GoalEditRequest = { goalId: string; title: string; expectedRevision: number };

type Props = {
  goal: { goalId: string; title: string; revision: number; blocked?: string };
  onSave: (request: GoalEditRequest) => Promise<boolean>;
  onClose: () => void;
};

const MIN_TITLE = 3;
const MAX_TITLE = 120;

/**
 * "Editar Goal" for a confirmed Goal: a bottom sheet on phones, a centred sheet on desktop. Saving is
 * the interactive confirmation the Kernel requires (POST /api/goals/:id/revisions, dashboard Origin);
 * the Goal keeps its id, its Mission, earlier attempts, Evidence and Finds, and moves to revision N+1.
 * It never runs anything: searching with the new text is a separate "Buscar más" confirmation.
 */
export function GoalEditSheet({ goal, onSave, onClose }: Props) {
  const titleId = useId();
  const noteId = useId();
  const fieldId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string>();
  const [text, setText] = useState(goal.title);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const normalized = text.trim().replace(/\s+/g, ' ');
  const unchanged = normalized.toLocaleLowerCase('es') === goal.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  const tooShort = normalized.length < MIN_TITLE;
  const keywords = useMemo(() => keywordsFromGoal(normalized), [normalized]);
  const before = useMemo(() => new Set(keywordsFromGoal(goal.title)), [goal.title]);
  const removed = useMemo(() => [...before].filter((word) => !keywords.includes(word)), [before, keywords]);
  const disabled = pending || Boolean(goal.blocked) || unchanged || tooShort || normalized.length > MAX_TITLE;

  useEffect(() => {
    const node = field.current;
    node?.focus();
    node?.setSelectionRange(node.value.length, node.value.length);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setSaveError(undefined);
    try {
      const ok = await onSave({ goalId: goal.goalId, title: normalized, expectedRevision: goal.revision });
      if (ok) onClose();
      else setSaveError(t('f.saveFailedRev'));
    } catch {
      setSaveError(t('f.saveFailed'));
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button, textarea') ?? [])]
      .filter((control) => !control.disabled);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first || !last) { event.preventDefault(); dialogRef.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
      event.preventDefault(); first.focus();
    }
  }

  const sheet = <div className="goal-edit-root" onKeyDown={onKeyDown}>
    <div className="goal-edit-scrim" aria-hidden="true" onClick={() => { if (!pending) onClose(); }} />
    <div ref={dialogRef} tabIndex={-1} className="goal-edit-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={saveError ? `${noteId} ${errorId}` : noteId}>
      <span className="goal-edit-grip" aria-hidden="true" />
      <header className="goal-edit-head">
        <div>
          <small className="goal-edit-eyebrow">EDITAR GOAL · REVISIÓN {goal.revision} → {goal.revision + 1}</small>
          <h2 id={titleId}>{t('f.editTitle')}</h2>
        </div>
        <button type="button" className="goal-edit-close" aria-label={t('f.closeEdit')} disabled={pending} onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <form onSubmit={submit}>
        <label className="goal-edit-label" htmlFor={fieldId}>{t('f.goalText')}</label>
        <textarea id={fieldId} ref={field} className="goal-edit-field" readOnly={pending} rows={3} maxLength={MAX_TITLE} value={text}
          onChange={(event) => setText(event.target.value)} aria-invalid={tooShort ? 'true' : undefined} />
        <p className="goal-edit-count" aria-live="polite">{normalized.length}/{MAX_TITLE}</p>
        <div className="goal-edit-keywords" aria-label={t('f.nextKeywords')}>
          <small>{t('f.nextSearch')}</small>
          <ul>{keywords.length ? keywords.map((word) => <li key={word} data-new={before.has(word) ? undefined : 'true'}>{word}</li>) : <li data-empty="true">{t('f.noKeywords')}</li>}</ul>
          {removed.length ? <p className="goal-edit-removed">Deja de buscar: {removed.map((word) => <s key={word}>{word}</s>)}</p> : null}
        </div>
        <ul className="goal-edit-keeps" id={noteId}>
          <li><Check aria-hidden="true" />{t('f.editKeeps')}</li>
          <li><Check aria-hidden="true" />{t('f.editNoRun')}</li>
        </ul>
        {saveError ? <p id={errorId} className="goal-edit-blocked" role="alert">{saveError}</p> : null}
        {goal.blocked ? <p className="goal-edit-blocked" role="status">{goal.blocked}</p> : null}
        <div className="goal-edit-actions">
          <button type="button" className="goal-edit-cancel" disabled={pending} onClick={onClose}>{t('f.cancel')}</button>
          <button type="submit" className="goal-edit-save" disabled={disabled}><Pencil aria-hidden="true" />{pending ? 'Guardando…' : t('f.saveRevision')}</button>
        </div>
      </form>
    </div>
  </div>;
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}
