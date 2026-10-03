import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BriefingModal, BRIEFING_KEY } from "@/components/briefing-modal";
import { FirstUse } from "@/components/first-use";
import { GoalComposer } from "@/components/goal-composer";
import { Panel } from "@/components/panel";
import { SealMark } from "@/components/seal-mark";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { openContradictions } from "@/lib/kernel/contradiction";
import { latestDossierByGoal, spawnedFromDossier } from "@/lib/kernel/dossier";
import { useKernel } from "@/lib/kernel/store";
import type { Dossier } from "@/lib/kernel/types";
import { startCase } from "@/lib/research/run-investigation";
import { formatWhen } from "@/lib/utils";
import { useIsOwner } from "@/lib/ui/use-role";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const goals = useKernel((s) => s.goals);
  const dossiers = useKernel((s) => s.dossiers);
  const recent = goals.slice(0, 4);
  const sealed = latestDossierByGoal(dossiers).slice(0, 3);
  const watched = goals.filter((goal) => goal.watched).slice(0, 4);
  const inFlight = goals.filter((goal) => goal.status !== "complete").slice(0, 4);
  const open = inFlight.length ? inFlight : sealed.length ? [] : recent;
  const nextItems = latestDossierByGoal(dossiers)
    .filter((item) => item.next.trim())
    .slice(0, 3)
    .map((item) => ({
      dossier: item,
      goal: goals.find((goal) => goal.id === item.goalId),
    }));
  const contradictions = useKernel((s) => s.contradictions);
  const tensions = openContradictions(contradictions);
  const [briefing, setBriefing] = useState(false);
  const owner = useIsOwner();

  useEffect(() => {
    if (goals.length) return;
    try {
      if (sessionStorage.getItem(BRIEFING_KEY) === "1") return;
    } catch {
      return;
    }
    setBriefing(true);
  }, [goals.length]);

  return (
    <div className="space-y-10">
      <header className="enter-up">
        <p className="kicker">Forja de inteligencia</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight md:text-5xl md:leading-tight">
          Pregunta lo que tendrías que poder demostrar.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
          Efesto lee la web pública, retiene URL y huella, y se niega a cerrar el caso si la página no cubre el Goal.
          Completado no es un spinner. Completado es un sello del Kernel.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setBriefing(true)}>
            Cómo funciona
          </Button>
          <Link
            to="/verificar"
            className="inline-flex min-h-11 items-center rounded-md px-4 text-sm text-muted"
          >
            Verificar un paquete
          </Link>
        </div>
      </header>

      <div className="enter-up enter-up-2">
        <GoalComposer />
      </div>

      {goals.length === 0 ? <FirstUse /> : null}

      {watched.length ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">En vigilancia</h2>
          <ul className="space-y-2">
            {watched.map((goal) => (
              <li key={goal.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: goal.id }}
                  className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-border"
                >
                  <span className="min-w-0 overflow-hidden">
                    <span className="block truncate text-sm">{goal.text}</span>
                    <span className="mt-1 block truncate text-xs text-subtle">
                      {goal.lastWatchSummary
                        ? goal.lastWatchSummary
                        : "Aún no se han releído las fuentes."}
                    </span>
                  </span>
                  <StatusChip kind="watched" className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nextItems.length ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Lo que sigue</h2>
          <ul className="space-y-2">
            {nextItems.map(({ dossier, goal }) => (
              <li key={dossier.id}>
                <NextCaseRow dossier={dossier} origin={goal?.text ?? "Caso sellado"} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tensions.length ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Tensión</h2>
          <ul className="space-y-2">
            {tensions.map((hit) => (
              <li key={hit.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: hit.goalId }}
                  className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-border"
                >
                  <span className="min-w-0 overflow-hidden">
                    <span className="block truncate text-sm">{hit.note}</span>
                    <span className="mt-1 block truncate text-xs text-subtle">
                      {hit.left.label} · {hit.right.label}
                    </span>
                  </span>
                  <StatusChip kind={hit.kind} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sealed.length ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Dosieres sellados</h2>
          <ul className="space-y-2">
            {sealed.map((dossier) => {
              const goal = goals.find((item) => item.id === dossier.goalId);
              return (
                <li key={dossier.id}>
                  <Link
                    to="/goals/$goalId"
                    params={{ goalId: dossier.goalId }}
                    className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-border"
                  >
                    <SealMark hash={dossier.sealHash} className="size-10 shrink-0" />
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate text-sm">
                        {goal?.text ?? "Caso sellado"}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[11px] text-subtle">
                        {dossier.sealHash.slice(0, 12)}… · {formatWhen(dossier.sealedAt)}
                      </span>
                    </span>
                    <StatusChip kind="sealed" className="shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {inFlight.length || !sealed.length ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Reciente</h2>
          {open.length === 0 ? (
            <p className="text-sm text-subtle">
              El núcleo está vacío. Forja un caso o elige una pregunta de abajo.
            </p>
          ) : (
            <ul className="space-y-2">
              {open.map((goal) => (
                <li key={goal.id}>
                  <Link
                    to="/goals/$goalId"
                    params={{ goalId: goal.id }}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-border"
                  >
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-sm">{goal.text}</span>
                      <span className="mt-1 block text-xs text-subtle">
                        {formatWhen(goal.createdAt)}
                      </span>
                    </span>
                    <StatusChip
                      kind={
                        goal.status === "researching"
                          ? "researching"
                          : goal.status === "complete"
                            ? "complete"
                            : goal.status === "blocked"
                              ? "blocked"
                              : goal.status === "failed"
                                ? "failed"
                              : "draft"
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Panel className="p-5">
          <p className="kicker">Contraste</p>
          <h3 className="mt-2 text-sm font-medium">El Kernel sella. El modelo no.</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Completado es un punzón. Un agente no puede marcar el caso por su cuenta.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="kicker">Escoria</p>
          <h3 className="mt-2 text-sm font-medium">Lo que no cubre el Goal se cae.</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            URL de relleno, páginas bloqueadas, un titular redondo: no cierran el caso.
          </p>
        </Panel>
        <Panel className="p-5">
          <p className="kicker">Paquete</p>
          <h3 className="mt-2 text-sm font-medium">Huella, no confianza.</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            SHA-256 de cada página. Ed25519 en el sobre. Verificar lo pega cualquiera.
          </p>
        </Panel>
      </section>

      {owner ? (
      <Panel className="p-5">
        <p className="kicker">Kernel para agentes</p>
        <h2 className="mt-2 font-display text-xl tracking-tight">Hermes, OpenClaw y Grok consultan el sello</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          No es un conector de búsqueda. Es la puerta de admisión. Un agente envía un objetivo, recibe un
          Kernel Packet con evidencia, huella Ed25519 y estado. Si no hay fuente pública, el paquete queda incompleto.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/agentes"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Conectar un agente
          </Link>
          <Link
            to="/verificar"
            className="inline-flex min-h-11 items-center rounded-md bg-surface-2 px-4 text-sm text-fg shadow-border"
          >
            Verificar un paquete
          </Link>
        </div>
      </Panel>
      ) : null}

      <BriefingModal open={briefing} onOpenChange={setBriefing} />
    </div>
  );
}

function NextCaseRow({ dossier, origin }: { dossier: Dossier; origin: string }) {
  const goals = useKernel((s) => s.goals);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const spawned = spawnedFromDossier(goals, dossier.id);
  const className =
    "block w-full min-h-14 min-w-0 rounded-xl bg-surface px-4 py-3 text-left shadow-border";

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await startCase(
        dossier.next,
        {
          goalId: dossier.goalId,
          dossierId: dossier.id,
        },
        (goal) => {
          void navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
        },
      );
      if (!result.ok) return;
    } finally {
      setBusy(false);
    }
  }

  if (spawned) {
    return (
      <Link to="/goals/$goalId" params={{ goalId: spawned.id }} className={className}>
        <span className="block truncate text-sm">{dossier.next}</span>
        <span className="mt-1 block truncate text-xs text-subtle">
          Ya abierto · {origin}
        </span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => void open()} disabled={busy} className={className}>
      <span className="block truncate text-sm">{dossier.next}</span>
      <span className="mt-1 block truncate text-xs text-subtle">
        {busy ? "Forjando…" : origin}
      </span>
    </button>
  );
}

