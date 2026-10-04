'use client';

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
    if (disabled) return;
    setPending(true);
    const ok = await onSave({ goalId: goal.goalId, title: normalized, expectedRevision: goal.revision });
    setPending(false);
    if (ok) onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) { event.stopPropagation(); onClose(); }
  }

  const sheet = <div className="goal-edit-root" onKeyDown={onKeyDown}>
    <div className="goal-edit-scrim" aria-hidden="true" onClick={() => { if (!pending) onClose(); }} />
    <div className="goal-edit-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={noteId}>
      <span className="goal-edit-grip" aria-hidden="true" />
      <header className="goal-edit-head">
        <div>
          <small className="goal-edit-eyebrow">EDITAR GOAL · REVISIÓN {goal.revision} → {goal.revision + 1}</small>
          <h2 id={titleId}>Ajusta lo que buscas</h2>
        </div>
        <button type="button" className="goal-edit-close" aria-label="Cerrar edición" disabled={pending} onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <form onSubmit={submit}>
        <label className="goal-edit-label" htmlFor={fieldId}>Texto del Goal</label>
        <textarea id={fieldId} ref={field} className="goal-edit-field" rows={3} maxLength={MAX_TITLE} value={text}
          onChange={(event) => setText(event.target.value)} aria-invalid={tooShort ? 'true' : undefined} />
        <p className="goal-edit-count" aria-live="polite">{normalized.length}/{MAX_TITLE}</p>
        <div className="goal-edit-keywords" aria-label="Palabras clave de la próxima búsqueda">
          <small>Próxima búsqueda</small>
          <ul>{keywords.length ? keywords.map((word) => <li key={word} data-new={before.has(word) ? undefined : 'true'}>{word}</li>) : <li data-empty="true">sin palabras clave</li>}</ul>
          {removed.length ? <p className="goal-edit-removed">Deja de buscar: {removed.map((word) => <s key={word}>{word}</s>)}</p> : null}
        </div>
        <ul className="goal-edit-keeps" id={noteId}>
          <li><Check aria-hidden="true" />Se conservan el Goal, su misión, los intentos anteriores, la Evidence y los Finds.</li>
          <li><Check aria-hidden="true" />No ejecuta nada: para buscar con el texto nuevo, confirma «Buscar más» después.</li>
        </ul>
        {goal.blocked ? <p className="goal-edit-blocked" role="status">{goal.blocked}</p> : null}
        <div className="goal-edit-actions">
          <button type="button" className="goal-edit-cancel" disabled={pending} onClick={onClose}>Cancelar</button>
          <button type="submit" className="goal-edit-save" disabled={disabled}><Pencil aria-hidden="true" />{pending ? 'Guardando…' : 'Guardar revisión'}</button>
        </div>
      </form>
    </div>
  </div>;
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}
