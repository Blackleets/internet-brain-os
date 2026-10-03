import { Link } from "@tanstack/react-router";
import { Panel } from "./panel";
import { StatusChip } from "./status-chip";
import { formatWhen } from "@/lib/utils";
import type { CaseView } from "@/lib/ui/case-view";

export function CaseViewCard({
  view,
  goalId,
}: {
  view: CaseView;
  goalId: string;
}) {
  return (
    <Panel className="p-5" data-case-view="true">
      <p className="kicker">Case · {view.identityLabel}</p>
      <h2 className="mt-2 font-display text-2xl tracking-tight">{view.question}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.sealHash ? <StatusChip kind="sealed" /> : view.incomplete ? null : <StatusChip kind="researching" />}
        {view.confidence ? <span className="text-xs text-subtle">{view.confidence}</span> : null}
      </div>
      {view.conclusion ? (
        <p className="mt-4 text-sm leading-relaxed text-fg">{view.conclusion}</p>
      ) : (
        <p className="mt-4 text-sm text-muted">Conclusión no disponible. El Kernel no inventó el resto.</p>
      )}
      {view.why ? <p className="mt-3 text-sm text-ember">{view.why}</p> : null}
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">Evidencia</dt>
          <dd className="mt-1">
            {view.evidenceCount ? (
              <Link to="/goals/$goalId" params={{ goalId }} hash="evidencia" className="text-accent">
                {view.evidenceCount} {view.evidenceCount === 1 ? "página retenida" : "páginas retenidas"}
              </Link>
            ) : (
              "Ninguna retenida"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">Fuentes</dt>
          <dd className="mt-1 text-muted">
            {view.sourceHosts.length ? view.sourceHosts.join(" · ") : "Sin dominios"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">Contradicciones</dt>
          <dd className="mt-1 text-muted">{view.contradictionCount}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">Verificado</dt>
          <dd className="mt-1 text-muted">
            {view.sealedAt ? formatWhen(view.sealedAt) : "Todavía no hay sello"}
          </dd>
        </div>
      </dl>
      {view.sealHash ? (
        <p className="mt-4 break-all font-mono text-[11px] text-subtle">{view.sealHash}</p>
      ) : null}
      {view.sealHash ? (
        <p className="mt-3 text-xs leading-relaxed text-subtle">Contraste del Kernel. El modelo no admite.</p>
      ) : null}
    </Panel>
  );
}
