import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FindingCard } from "@/components/finding-card";
import { EvidencePanel } from "@/components/evidence-panel";
import { SourceMark } from "@/components/source-mark";
import { StatusChip } from "@/components/status-chip";
import { Panel } from "@/components/panel";
import { DossierSheet } from "@/components/dossier-sheet";
import { WatchPanel } from "@/components/watch-panel";
import { ForgeTrace } from "@/components/forge-trace";
import { ForgeReceipt } from "@/components/forge-receipt";
import { PacketStamp } from "@/components/packet-stamp";
import { CaseViewCard } from "@/components/case-view";
import { investigationSteps } from "@/lib/ui/working-copy";
import { buildCaseView } from "@/lib/ui/case-view";
import { Button } from "@/components/ui/button";
import { IconExternal, IconRefresh, IconVault, IconWatch } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import { relatedMemory } from "@/lib/kernel/related-memory";
import { relatedDossiers } from "@/lib/kernel/watch";
import {
  sealsForGoal,
  sealChangeNote,
  childrenOf,
  chooseInstrument,
  memoryConsultNote,
} from "@/lib/kernel/dossier";

import { normalizeUrl } from "@/lib/kernel/watch";
import {
  readLead,
  runInvestigation,
  incorporateUncovered,
  reinterpretWithMemory,
} from "@/lib/research/run-investigation";
import { runWatch } from "@/lib/research/run-watch";
import { planResearch } from "@/lib/research/planner";
import { buildKernelPacket, type KernelPacket } from "@/lib/kernel/packet";
import { formatWhen } from "@/lib/utils";
import { useAI } from "@/lib/ai/store";
import { connectedActor, useAgentPresence } from "@/lib/agent/presence-store";
import { interpretationLabel, latestInterpretation } from "@/lib/ai/observe";
import { modelsFor, PROVIDER_META } from "@/lib/ai/catalog";

export const Route = createFileRoute("/goals/$goalId")({
  component: GoalDetail,
});

function GoalDetail() {
  const { goalId } = Route.useParams();
  const goals = useKernel((s) => s.goals);
  const allFindings = useKernel((s) => s.findings);
  const allEvidence = useKernel((s) => s.evidence);
  const memory = useKernel((s) => s.memory);
  const dossiers = useKernel((s) => s.dossiers);
  const watchPasses = useKernel((s) => s.watchPasses);
  const activity = useKernel((s) => s.activity);
  const contradictions = useKernel((s) => s.contradictions);
  const confidenceRecords = useKernel((s) => s.confidence);
  const learning = useKernel((s) => s.learning);
  const toggleWatch = useKernel((s) => s.toggleWatch);
  const goal = goals.find((item) => item.id === goalId);
  const findings = allFindings.filter((item) => item.goalId === goalId);
  const evidence = allEvidence.filter((item) => item.goalId === goalId);
  const caseSeals = sealsForGoal(dossiers, goalId);
  const dossier = caseSeals[0];
  const priorSeals = caseSeals.slice(1);
  const lastWatch = watchPasses.find((item) => item.goalId === goalId);
  const leads = goal?.leads ?? [];
  const [rerunning, setRerunning] = useState(false);
  const [rereadError, setRereadError] = useState<string | null>(null);
  const [readingLead, setReadingLead] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [incorporating, setIncorporating] = useState(false);
  const [reinterpreting, setReinterpreting] = useState(false);
  const [showAllSeals, setShowAllSeals] = useState(false);
  const [packet, setPacket] = useState<KernelPacket | null>(null);

  const sealedFindingIds = new Set(dossier?.findingIds ?? []);
  const currentFindings = dossier
    ? findings.filter((item) => sealedFindingIds.has(item.id))
    : findings;
  const priorFindings = dossier
    ? findings.filter((item) => !sealedFindingIds.has(item.id))
    : [];
  const related = useMemo(
    () => (goal ? relatedMemory(goal.text, memory, allFindings, goal.id) : []),
    [goal, memory, allFindings],
  );
  const otherCases = useMemo(
    () =>
      goal
        ? relatedDossiers({
            goalId: goal.id,
            goalText: goal.text,
            dossiers,
            goals,
            findings: allFindings,
            memory,
          })
        : [],
    [goal, dossiers, goals, allFindings, memory],
  );
  const parent = goal?.spawnedFromGoalId
    ? goals.find((item) => item.id === goal.spawnedFromGoalId)
    : undefined;
  const spawned = goal ? childrenOf(goals, goal.id) : [];
  const instrument = dossier
    ? chooseInstrument(dossier, evidence, related, memory)
    : "NADA";
  const stale = instrument === "INCORPORAR";
  const memoryNote = dossier ? memoryConsultNote(dossier, related, memory) : null;
  const visiblePrior = showAllSeals ? priorSeals : priorSeals.slice(0, 4);
  const hiddenSeals = Math.max(0, priorSeals.length - visiblePrior.length);
  const busy = rerunning || incorporating || reinterpreting || Boolean(readingLead);
  const selectedProvider = useAI((s) => s.provider);
  const selectedModel = useAI((s) => s.model);
  const presence = useAgentPresence();
  const actor = connectedActor(presence);
  const liveModel =
    modelsFor(selectedProvider).find((item) => item.id === selectedModel)?.label ?? selectedModel;
  const liveProvider = PROVIDER_META[selectedProvider].label;
  const interpretation = latestInterpretation(activity, goalId);
  const interpreterLabel = interpretation
    ? interpretationLabel(interpretation.ai)
    : `${liveModel} · ${liveProvider}`;
  const progress = goal
    ? investigationSteps({
        stage: goal.stage,
        status: goal.status,
        leadCount: leads.length,
        evidenceCount: evidence.length,
        findingCount: findings.length,
        contradictionCount: contradictions.filter((item) => item.goalId === goal.id).length,
        confidenceCount: confidenceRecords.filter((item) =>
          findings.some((finding) => finding.id === item.findingId),
        ).length,
        learningCount: learning.filter((item) => item.caseIds.includes(goal.id)).length,
        sealed: Boolean(dossier),
      })
    : null;
  const planQueries = useMemo(
    () => (goal ? planResearch(goal.text).queries : []),
    [goal],
  );
  const caseView = useMemo(() => {
    if (!goal) return null;
    return buildCaseView({
      goal,
      findings,
      evidence,
      contradictions: contradictions.filter((item) => item.goalId === goal.id),
      confidence: confidenceRecords.filter((item) =>
        findings.some((finding) => finding.id === item.findingId),
      ),
      dossier,
    });
  }, [goal, findings, evidence, contradictions, confidenceRecords, dossier]);

  useEffect(() => {
    if (!goal || goal.status === "researching" || rerunning) {
      setPacket(null);
      return;
    }
    let cancelled = false;
    void buildKernelPacket({
      goal,
      evidence,
      findings,
      dossier,
      contradictions: contradictions.filter((item) => item.goalId === goal.id),
    }).then((next) => {
      if (!cancelled) setPacket(next);
    });
    return () => {
      cancelled = true;
    };
  }, [goal, evidence, findings, dossier, contradictions, rerunning]);

  async function reread() {
    if (!goal || rerunning) return;
    setRerunning(true);
    setRereadError(null);
    try {
      const result = evidence.length
        ? await runWatch(goal.id)
        : await runInvestigation(goal.id, goal.text);
      if (result.status === "blocked" && "reason" in result && result.reason) {
        setRereadError(result.reason);
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "La relectura no pudo continuar.";
      setRereadError(reason);
      if (!evidence.length) {
        useKernel.getState().setGoalStage(goal.id, "failed", { blockedReason: reason });
      }
    } finally {
      setRerunning(false);
    }
  }

  async function leerPista(url: string) {
    if (!goal || readingLead) return;
    setReadingLead(url);
    setLeadError(null);
    try {
      const result = await readLead(goal.id, url);
      if (!result.ok) setLeadError(result.reason);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "No se pudo leer la pista.");
    } finally {
      setReadingLead(null);
    }
  }

  async function incorporar() {
    if (!goal || incorporating || rerunning || reinterpreting) return;
    setIncorporating(true);
    setRereadError(null);
    try {
      const result = await incorporateUncovered(goal.id);
      if (result.status === "blocked" && result.reason) {
        setRereadError(result.reason);
      }
    } catch (error) {
      setRereadError(
        error instanceof Error ? error.message : "No se pudo incorporar la evidencia.",
      );
    } finally {
      setIncorporating(false);
    }
  }

  async function reinterpretar() {
    if (!goal || busy) return;
    setReinterpreting(true);
    setRereadError(null);
    try {
      const result = await reinterpretWithMemory(goal.id);
      if (result.status === "blocked" && result.reason) {
        setRereadError(result.reason);
      }
    } catch (error) {
      setRereadError(
        error instanceof Error ? error.message : "No se pudo reinterpretar con la memoria vigente.",
      );
    } finally {
      setReinterpreting(false);
    }
  }

  if (!goal) {
    return (
      <p className="text-sm text-muted">
        Este caso no está en el Kernel local.{" "}
        <Link to="/goals" className="text-accent">
          Volver
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">{goal.text}</h1>
          {parent ? (
            <p className="mt-2 text-sm text-muted">
              <Link
                to="/goals/$goalId"
                params={{ goalId: parent.id }}
                className="text-accent"
              >
                Nace de: {parent.text}
              </Link>
              <span className="mt-1 block text-xs text-subtle">
                Consultó el dosier del que nace. No es evidencia ni memoria de este caso.
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={goal.watched ? "secondary" : "ghost"}
            size="sm"
            onClick={() => toggleWatch(goal.id)}
          >
            <IconWatch className="size-3.5" />
            {goal.watched ? "Vigilando" : "Vigilar"}
          </Button>
          {goal.status !== "researching" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void reread()}
              disabled={busy || instrument === "REINTERPRETAR"}
            >
              <IconRefresh className="size-3.5" />
              {rerunning
                ? "Forjando…"
                : evidence.length
                  ? "Releer fuentes"
                  : "Forjar de nuevo"}
            </Button>
          ) : null}
        </div>
      </header>

      {rereadError ? <p className="text-sm text-danger">{rereadError}</p> : null}

      {caseView && goal.status !== "researching" && !rerunning ? (
        <CaseViewCard view={caseView} goalId={goal.id} />
      ) : null}

      {stale ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-sm text-ember">
            Hay evidencia que este sello no cubre. Incorporarla no relee las fuentes ya
            selladas.
          </p>
          {goal.status !== "researching" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void incorporar()}
            >
              {incorporating ? "Incorporando…" : "Incorporar al sello"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {memoryNote ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-sm text-ember">
            {memoryNote} Reinterpretar no relee las fuentes; la memoria no es evidencia.
          </p>
          {goal.status !== "researching" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void reinterpretar()}
            >
              {reinterpreting ? "Reinterpretando…" : "Reinterpretar con memoria vigente"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {dossier ? (
        <DossierSheet
          dossier={dossier}
          goal={goal}
          findings={findings}
          evidence={evidence}
          memory={memory}
        />
      ) : null}

      {priorSeals.length ? (
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Sellos anteriores</h2>
          <p className="mt-2 text-sm text-muted">
            El sello vigente está arriba. Estos quedan en el Kernel.
          </p>
          <ul className="mt-4 space-y-3">
            {visiblePrior.map((seal, index) => {
              const newer = index === 0 ? dossier : visiblePrior[index - 1];
              return (
                <li key={seal.id} className="min-w-0">
                  <p className="break-all font-mono text-[11px] text-subtle">
                    {seal.sealHash}
                  </p>
                  <p className="mt-1 text-xs text-subtle">{formatWhen(seal.sealedAt)}</p>
                  {newer ? (
                    <p className="mt-1 text-sm text-muted">{sealChangeNote(newer, seal)}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {hiddenSeals ? (
            <button
              type="button"
              className="mt-3 text-sm text-accent"
              onClick={() => setShowAllSeals(true)}
            >
              Mostrar {hiddenSeals} sello{hiddenSeals === 1 ? "" : "s"} anterior
              {hiddenSeals === 1 ? "" : "es"}
            </button>
          ) : null}
        </Panel>
      ) : null}

      {lastWatch ? <WatchPanel pass={lastWatch} /> : null}

      {spawned.length ? (
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Casos abiertos desde aquí</h2>
          <p className="mt-2 text-sm text-muted">
            Siguieron un siguiente de este dosier. No son evidencia de este caso.
          </p>
          <ul className="mt-4 space-y-3">
            {spawned.map((child) => (
              <li key={child.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: child.id }}
                  className="block min-w-0 text-sm text-accent"
                >
                  {child.text}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {otherCases.length ? (
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Otros casos en el núcleo</h2>
          <p className="mt-2 text-sm text-muted">
            {otherCases.some((hit) => hit.kind === "tension")
              ? "Hay tensión con memoria de otro caso. No es evidencia de este."
              : "Mismo terreno. No es evidencia de este caso."}
          </p>
          <ul className="mt-4 space-y-3">
            {otherCases.map((hit) => (
              <li key={hit.dossier.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: hit.dossier.goalId }}
                  className="block min-w-0"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{hit.goalText}</span>
                    {hit.kind === "tension" ? <StatusChip kind="tension" /> : null}
                  </span>
                  <span className="mt-1 block text-xs text-subtle">{hit.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {related.some((hit) => hit.memory.goalId !== goal.id) ? (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-muted">
            <IconVault className="size-4 text-accent" />
            <h2 className="text-sm font-medium text-fg">Ya en memoria</h2>
          </div>
          <p className="mb-3 text-sm text-muted">
            El Kernel ya recuerda esto. No es evidencia de este caso; informa el
            contexto. Tú decides si sigue siendo útil.
          </p>
          <ul className="space-y-3">
            {related
              .filter((hit) => hit.memory.goalId !== goal.id)
              .map((hit) => {
                const informed = (hit.memory.informedGoalIds ?? []).length;
                return (
                  <li key={hit.memory.id}>
                    <p className="text-sm">{hit.memory.title}</p>
                    <p className="mt-1 text-xs text-subtle">{hit.memory.why}</p>
                    {informed ? (
                      <p className="mt-1 text-xs text-subtle">
                        Informó {informed} {informed === 1 ? "caso" : "casos"} posterior
                        {informed === 1 ? "" : "es"}.
                      </p>
                    ) : null}
                    <Link
                      to="/memory"
                      className="mt-2 inline-flex min-h-10 items-center text-sm text-accent"
                    >
                      Abrir memoria
                    </Link>
                  </li>
                );
              })}
          </ul>
        </Panel>
      ) : null}

      {goal.status === "researching" || rerunning ? (
        <ForgeTrace
          kind={rerunning && evidence.length ? "reread" : "investigate"}
          stage={goal.stage}
          model={liveModel}
          agent={actor}
          steps={progress?.steps}
          planQueries={planQueries}
          discovery={goal.discovery}
          leads={leads}
          evidence={evidence}
          findingCount={findings.length}
          contradictionCount={contradictions.filter((item) => item.goalId === goal.id).length}
          sealed={Boolean(dossier)}
          blockedReason={goal.blockedReason}
        />
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-4">
          {goal.status === "researching" || rerunning ? null : (
            <>
              <ForgeReceipt
                goal={goal}
                evidenceCount={evidence.length}
                findingCount={findings.length}
                contradictionCount={contradictions.filter((item) => item.goalId === goal.id).length}
                sealed={Boolean(dossier)}
                sealHash={dossier?.sealHash}
              />
              {packet ? <PacketStamp packet={packet} /> : null}
            </>
          )}
          {goal.stage === "blocked" || goal.stage === "failed" ? (
            <p className="text-sm text-ember">
              {goal.blockedReason ?? "Investigación incompleta. El Kernel no inventó fuentes."}
            </p>
          ) : null}
          {goal.status === "researching" || rerunning ? null : interpretation ? (
            <p className="text-xs text-subtle">
              {interpretation.ok
                ? `${interpreterLabel} interpretó. El Kernel admitió el hallazgo.`
                : `${interpreterLabel} no interpretó. La evidencia retenida sigue en el Kernel.`}
              {!interpretation.ok ? (
                <>
                  {" "}
                  <Link to="/settings" className="text-accent">
                    Configurar modelo
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="space-y-8">
          {currentFindings.length ? (
            <div className="space-y-4">
              {currentFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          ) : goal.status === "researching" || rerunning ? null : (
            <p className="text-sm text-muted">
              El Kernel no selló un hallazgo. Si hay evidencia retenida, sigue en el caso. El modelo no inventó la respuesta.
            </p>
          )}
          {priorFindings.length ? (
            <div className="space-y-4">
              <h2 className="font-display text-2xl">Hallazgos anteriores</h2>
              <p className="text-sm text-muted">
                Quedan en el Kernel. El dosier sellado usa la lectura vigente.
              </p>
              {priorFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {leads.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-muted">
            <span>
              {leads.length} {leads.length === 1 ? "pista" : "pistas"} · no son evidencia
            </span>
            <StatusChip kind="lead" />
          </summary>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Resultado de búsqueda. No es evidencia hasta que el Kernel recupera y admite
            la página.
          </p>
          {leadError ? <p className="mb-3 text-sm text-danger">{leadError}</p> : null}
          <ul className="space-y-2">
            {leads.map((lead) => {
              const retained = evidence.some(
                (item) => normalizeUrl(item.url) === normalizeUrl(lead.url),
              );
              return (
                <li key={lead.url}>
                  <Panel className="flex items-start gap-3 p-4">
                    <SourceMark host={lead.sourceHost} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{lead.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{lead.snippet}</p>
                      <p className="mt-1 font-mono text-[11px] text-subtle">
                        {lead.sourceHost}
                      </p>
                      {retained ? (
                        <p className="mt-2 text-xs text-verified">Ya retenida</p>
                      ) : goal.status !== "researching" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          disabled={Boolean(readingLead)}
                          onClick={() => void leerPista(lead.url)}
                        >
                          {readingLead === lead.url ? "Leyendo…" : "Leer"}
                        </Button>
                      ) : null}
                    </div>
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noreferrer"
                      className="grid size-11 shrink-0 place-items-center text-muted"
                      aria-label="Abrir pista"
                    >
                      <IconExternal className="size-4" />
                    </a>
                  </Panel>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {evidence.length ? (
        <section id="evidencia">
          <h2 className="mb-4 font-display text-2xl">Evidencia retenida</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {evidence.map((item) => (
              <EvidencePanel key={item.id} evidence={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
