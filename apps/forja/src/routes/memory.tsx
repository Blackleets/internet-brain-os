import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { IconVault } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import { contradictionLabel, contradictionsTouching } from "@/lib/kernel/contradiction";
import { explainMemory, isAdmittedMemory } from "@/lib/kernel/authority";
import { learningOriginLabel } from "@/lib/kernel/learning";
import { ACTIVITY_KIND_LABEL, eventsForMemory } from "@/lib/kernel/observability";
import { MEMORY_UNAVAILABLE } from "@/lib/ui/golden-path";
import { formatWhen } from "@/lib/utils";
import type { LearningCandidate } from "@/lib/kernel/types";

export const Route = createFileRoute("/memory")({ component: MemoryPage });

function MemoryPage() {
  const memory = useKernel((s) => s.memory);
  const findings = useKernel((s) => s.findings);
  const goals = useKernel((s) => s.goals);
  const forget = useKernel((s) => s.forgetMemory);
  const contradictions = useKernel((s) => s.contradictions);
  const dossiers = useKernel((s) => s.dossiers);
  const decisions = useKernel((s) => s.memoryDecisions);
  const learning = useKernel((s) => s.learning);
  const activity = useKernel((s) => s.activity);
  const openLearning = learning.filter(
    (item) => item.status === "ready" || item.status === "blocked" || item.status === "contradicted" || item.status === "duplicate" || item.status === "reinforcement" || item.status === "proposed",
  );

  return (
    <div>
      <PageHeader
        title="Memoria"
        description="Efesto recuerda por qué lo sabe. El aprendizaje propone; Memory Authority admite. El chat nunca aparece aquí."
      />
      {openLearning.length ? (
        <ul className="mb-8 space-y-3">
          {openLearning.map((item) => (
            <LearningOffer key={item.id} item={item} />
          ))}
        </ul>
      ) : null}
      {memory.length === 0 && openLearning.length === 0 ? (
        <EmptyState
          icon={<IconVault className="size-5" />}
          title={MEMORY_UNAVAILABLE.title}
          body={MEMORY_UNAVAILABLE.body}
          action={
            <Link
              to="/findings"
              className="inline-flex min-h-11 items-center text-sm text-accent"
            >
              Revisar hallazgos
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {memory.map((item) => {
            const informed = (item.informedGoalIds ?? [])
              .map((id) => goals.find((goal) => goal.id === id))
              .filter((goal): goal is NonNullable<typeof goal> => Boolean(goal));
            const later = findings.filter(
              (finding) => finding.deltaMemoryId === item.id && finding.goalId !== item.goalId,
            );
            const tensioned = later.filter((finding) => finding.delta === "tension");
            const confirmed = later.filter((finding) => finding.delta === "confirmed");
            const origin = goals.find((goal) => goal.id === item.goalId);
            const listed = contradictionsTouching(contradictions, { memoryId: item.id });
            const explained = explainMemory({
              memoryId: item.id,
              memory,
              decisions,
              dossiers,
              contradictions,
            });
            const fromLearning = item.candidateId
              ? learning.find((row) => row.id === item.candidateId)
              : undefined;
            const operational = eventsForMemory(activity, item.id);
            return (
              <li key={item.id}>
                <Panel className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusChip kind={item.lifecycle} />
                    {tensioned.length ? <StatusChip kind="tension" /> : null}
                    {confirmed.length ? <StatusChip kind="confirmed" /> : null}
                    <span className="text-xs text-subtle">
                      {formatWhen(item.admittedAt || item.proposedAt || item.closedAt || "")}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl">{item.title}</h2>
                  <p className="mt-2 text-sm text-muted">{item.why}</p>
                  {fromLearning ? (
                    <p className="mt-2 text-xs text-subtle">
                      Nació de un aprendizaje: {fromLearning.origin.note}
                    </p>
                  ) : null}
                  {explained?.supersedesId ? (
                    <p className="mt-2 text-xs text-subtle">Sustituye una memoria anterior.</p>
                  ) : null}
                  {explained?.supersededById ? (
                    <p className="mt-2 text-xs text-subtle">Ya no está vigente. Fue sustituida.</p>
                  ) : null}
                  {explained?.usedBySeals.length ? (
                    <p className="mt-2 text-xs text-subtle">
                      Un sello la consultó
                      {explained.usedBySeals[0]?.lifecycleAtConsult === "admitted" && item.lifecycle !== "admitted"
                        ? " cuando aún estaba admitida."
                        : "."}
                    </p>
                  ) : null}
                  {explained && explained.decisions.length ? (
                    <ol className="mt-3 space-y-1">
                      {explained.decisions.map((row) => (
                        <li key={row.id} className="text-xs text-subtle">
                          {row.from ?? "origen"} → {row.to} · {row.why}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {operational.length ? (
                    <ol className="mt-3 space-y-1">
                      {operational.map((event) => (
                        <li key={event.id} className="text-xs text-subtle">
                          {ACTIVITY_KIND_LABEL[event.kind]} · {event.summary}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {origin ? (
                    <Link
                      to="/goals/$goalId"
                      params={{ goalId: origin.id }}
                      className="mt-3 inline-block text-xs text-subtle"
                    >
                      Caso de origen: {origin.text}
                    </Link>
                  ) : null}
                  {informed.length ? (
                    <ul className="mt-3 space-y-1">
                      {informed.map((goal) => (
                        <li key={goal.id}>
                          <Link
                            to="/goals/$goalId"
                            params={{ goalId: goal.id }}
                            className="text-sm text-accent"
                          >
                            Informó: {goal.text}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-subtle">
                      Aún no ha informado ningún caso posterior.
                    </p>
                  )}
                  {tensioned.length
                    ? tensioned.map((finding) => {
                        const goal = goals.find((item) => item.id === finding.goalId);
                        return (
                          <p key={finding.id} className="mt-2 text-sm text-ember">
                            Tensión en{" "}
                            <Link
                              to="/goals/$goalId"
                              params={{ goalId: finding.goalId }}
                              className="text-accent"
                            >
                              {goal?.text ?? "un caso posterior"}
                            </Link>
                            {finding.deltaNote ? ` — ${finding.deltaNote}` : ""}
                          </p>
                        );
                      })
                    : null}
                  {listed.map((row) => (
                    <p key={row.id} className="mt-2 text-sm text-ember">
                      {contradictionLabel(row.kind)} — {row.note}
                    </p>
                  ))}
                  {confirmed.length
                    ? confirmed.map((finding) => {
                        const goal = goals.find((item) => item.id === finding.goalId);
                        return (
                          <p key={finding.id} className="mt-2 text-sm text-muted">
                            Confirmado por{" "}
                            <Link
                              to="/goals/$goalId"
                              params={{ goalId: finding.goalId }}
                              className="text-accent"
                            >
                              {goal?.text ?? "un caso posterior"}
                            </Link>
                          </p>
                        );
                      })
                    : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to="/findings/$findingId"
                      params={{ findingId: item.findingId }}
                      className="inline-flex min-h-11 items-center text-sm text-accent"
                    >
                      Inspeccionar origen
                    </Link>
                    {isAdmittedMemory(item) ? (
                      <Button variant="ghost" size="sm" onClick={() => forget(item.id)}>
                        Olvidar
                      </Button>
                    ) : null}
                  </div>
                  {item.lifecycle === "quarantined" ? <QuarantinedActions memoryId={item.id} /> : null}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LearningOffer({ item }: { item: LearningCandidate }) {
  const acceptLearning = useKernel((s) => s.acceptLearning);
  const rejectLearning = useKernel((s) => s.rejectLearning);
  const quarantineLearning = useKernel((s) => s.quarantineLearning);
  const contradictions = useKernel((s) => s.contradictions);
  const memory = useKernel((s) => s.memory);
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listed = contradictionsTouching(contradictions, {
    findingId: item.findingIds[0],
    memoryId: item.relatedMemoryId ?? item.relatedMemoryIds[0],
  }).filter(
    (row) =>
      item.contradictionIds.includes(row.id) ||
      (row.findingId && item.findingIds.includes(row.findingId)),
  );
  const related = item.relatedMemoryId
    ? memory.find((row) => row.id === item.relatedMemoryId)
    : undefined;
  const canAct = why.trim().length >= 8;

  function accept() {
    const result = acceptLearning(item.id, why);
    if (!result.ok) setError(result.reason);
  }

  function reject() {
    rejectLearning(item.id, why.trim() || "No es conocimiento durable.");
  }

  function quarantine() {
    const result = quarantineLearning(item.id, why);
    if (!result.ok) setError(result.reason);
  }

  return (
    <li>
      <Panel className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusChip kind={item.status} />
          <StatusChip kind={item.relation} />
        </div>
        <h2 className="font-display text-2xl">{item.title}</h2>
        <p className="mt-2 text-sm text-muted">{item.proposal}</p>
        <p className="mt-2 text-xs text-subtle">{item.origin.note}</p>
        <p className="mt-1 text-xs text-subtle">
          Origen: {learningOriginLabel(item.origin.kind)}. Evidencia: {item.evidenceIds.length}.
        </p>
        {related ? (
          <p className="mt-1 text-xs text-subtle">Memoria involucrada: {related.title}</p>
        ) : null}
        {item.blockedReason ? <p className="mt-2 text-sm text-ember">{item.blockedReason}</p> : null}
        {listed.map((row) => (
          <p key={row.id} className="mt-2 text-sm text-ember">
            {contradictionLabel(row.kind)} — {row.note}
          </p>
        ))}
        {item.status === "ready" || item.status === "proposed" ? (
          <div className="mt-4 space-y-3">
            <Input
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              placeholder="Por qué Memory Authority debería admitirlo"
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button size="sm" disabled={!canAct} onClick={accept}>
                Admitir
              </Button>
              {item.status === "ready" ? (
                <Button variant="ghost" size="sm" disabled={!canAct} onClick={quarantine}>
                  Cuarentena
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={reject}>
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>
    </li>
  );
}

function QuarantinedActions({ memoryId }: { memoryId: string }) {
  const admitQuarantined = useKernel((s) => s.admitQuarantined);
  const rejectQuarantined = useKernel((s) => s.rejectQuarantined);
  const [why, setWhy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canAct = why.trim().length >= 8;

  function admit() {
    const result = admitQuarantined(memoryId, why);
    if (!result.ok) setError(result.reason);
  }

  return (
    <div className="mt-4 space-y-3">
      <Input
        value={why}
        onChange={(event) => setWhy(event.target.value)}
        placeholder="Por qué Memory Authority debería admitirlo o rechazarlo"
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="sm" disabled={!canAct} onClick={admit}>
          Admitir
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => rejectQuarantined(memoryId, why.trim() || "No es conocimiento durable.")}
        >
          Rechazar
        </Button>
      </div>
    </div>
  );
}
