import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { OwnerOnly } from "@/components/owner-only";
import { IconLedger } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import {
  ACTIVITY_KIND_LABEL,
  causalChain,
  inspectKernel,
  kernelMetrics,
} from "@/lib/kernel/observability";
import type { ActivityEvent } from "@/lib/kernel/types";
import { interpretationLabel } from "@/lib/ai/observe";
import { formatWhen } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  component: () => (
    <OwnerOnly>
      <ActivityPage />
    </OwnerOnly>
  ),
});

function EventBody({
  event,
  focused,
}: {
  event: ActivityEvent;
  focused?: boolean;
}) {
  return (
    <Panel className={`px-4 py-3 text-sm ${focused ? "ring-1 ring-accent/40" : ""}`}>
      <p className="kicker">{ACTIVITY_KIND_LABEL[event.kind] ?? event.kind}</p>
      <p className="mt-1">{event.summary}</p>
      <p className="mt-1 text-xs text-subtle">
        {formatWhen(event.at)}
        {event.actor ? ` · ${event.actor === "operator" ? "operador" : event.actor === "replay" ? "replay" : "kernel"}` : ""}
        {event.source ? ` · ${event.source}` : ""}
      </p>
      {event.causal?.supersedes ? (
        <p className="mt-1 text-xs text-subtle">Sustituye {event.causal.supersedes}.</p>
      ) : null}
      {event.causal?.causedBy ? (
        <p className="mt-1 text-xs text-subtle">Provocado por un hecho anterior de la misma cadena.</p>
      ) : null}
      {event.ai ? (
        <p className="mt-1 text-xs text-subtle">
          {interpretationLabel(event.ai)}
          {event.ai.modelVersion ? ` · ${event.ai.modelVersion}` : ""}
          {typeof event.ai.latencyMs === "number" ? ` · ${event.ai.latencyMs} ms` : ""}
          {typeof event.ai.promptTokens === "number"
            ? ` · ${event.ai.promptTokens + (event.ai.completionTokens ?? 0)} tokens`
            : ""}
          {typeof event.ai.estimatedCostUsd === "number" ? ` · ~$${event.ai.estimatedCostUsd}` : ""}
          {event.ai.fallbackFrom ? ` · fallback desde ${event.ai.fallbackFrom.provider}/${event.ai.fallbackFrom.model}` : ""}
        </p>
      ) : null}
    </Panel>
  );
}

function ActivityPage() {
  const activity = useKernel((s) => s.activity);
  const state = useKernel();
  const [correlation, setCorrelation] = useState<string | null>(null);
  const health = useMemo(() => inspectKernel(state), [state]);
  const metrics = useMemo(() => kernelMetrics(state), [state]);
  const visible = correlation
    ? activity.filter((item) => item.correlationId === correlation)
    : activity;
  const chain = correlation && visible[0] ? causalChain(activity, visible[0].id) : [];

  return (
    <div>
      <PageHeader
        title="Actividad"
        description="Hechos del Kernel. No decide. No admite. No reescribe el pasado."
      />
      {activity.length === 0 ? (
        <EmptyState
          icon={<IconLedger className="size-5" />}
          title="Sin eventos todavía"
          body="Cuando investigues, el Kernel dejará constancia de cada admisión y cada rechazo."
          action={
            <Link to="/" className="inline-flex min-h-11 items-center text-sm text-accent">
              Abrir la forja
            </Link>
          }
        />
      ) : (
        <>
          <Panel className="mb-6 px-4 py-3">
            <p className={health.status === "healthy" ? "kicker text-verified" : "kicker text-ember"}>
              {health.status === "healthy" ? "Kernel íntegro" : "Kernel degradado"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {metrics.sealsCreated} sello(s) · {metrics.memoryAdmitted} memoria vigente · {metrics.contradictionsOpen} contradicción abierta · {metrics.confidenceEvaluations} evaluación de soporte
            </p>
            {health.status === "degraded" ? (
              <ul className="mt-3 space-y-1">
                {health.issues.slice(0, 6).map((item, index) => (
                  <li key={`${item.code}-${item.id ?? index}`} className="text-xs text-ember">
                    {item.note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-subtle">Las métricas se derivan del historial. No deciden nada.</p>
            )}
          </Panel>
          {correlation ? (
            <p className="mb-4 text-sm text-muted">
              Cadena {correlation}
              <button
                type="button"
                className="ml-3 text-accent"
                onClick={() => setCorrelation(null)}
              >
                Ver todo
              </button>
            </p>
          ) : null}
          <ol className="space-y-2">
            {(correlation && chain.length ? chain.slice().reverse() : visible).map((event) => {
              const body = <EventBody event={event} focused={correlation === event.correlationId} />;
              return (
                <li key={event.id}>
                  {event.goalId ? (
                    <div className="block">
                      <Link to="/goals/$goalId" params={{ goalId: event.goalId }} className="block">
                        {body}
                      </Link>
                      <button
                        type="button"
                        className="mt-1 text-xs text-subtle"
                        onClick={() => setCorrelation(event.correlationId)}
                      >
                        Seguir la cadena
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="block w-full text-left" onClick={() => setCorrelation(event.correlationId)}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
