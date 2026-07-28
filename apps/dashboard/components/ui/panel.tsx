import { useId, type ReactNode } from 'react';

type PanelProps = {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function Panel({ title, children, eyebrow, className }: PanelProps) {
  const headingId = useId();

  return (
    <section className={['panel', className].filter(Boolean).join(' ')} aria-labelledby={headingId}>
      <header className="panel-header">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2 id={headingId}>{title}</h2>
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}
