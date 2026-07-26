import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function Panel({ title, children, eyebrow, className }: PanelProps) {
  return (
    <section className={['panel', className].filter(Boolean).join(' ')} aria-labelledby={`${title}-heading`}>
      <header className="panel-header">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2 id={`${title}-heading`}>{title}</h2>
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}
