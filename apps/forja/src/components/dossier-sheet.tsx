import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StatusChip } from "./status-chip";
import { Button } from "./ui/button";
import { SealMark } from "./seal-mark";
import { IconExport } from "./icons";
import type { Dossier, Evidence, Finding, Goal, MemoryRecord } from "@/lib/kernel/types";
import { dossierToMarkdown, spawnedFromDossier } from "@/lib/kernel/dossier";
import { memoryInfluence } from "@/lib/kernel/provenance";
import { relatedMemory } from "@/lib/kernel/related-memory";
import { contradictionLabel, contradictionsTouching } from "@/lib/kernel/contradiction";
import { isAdmittedMemory } from "@/lib/kernel/authority";
import { HISTORIAL_INSUFICIENTE, replaySeal } from "@/lib/kernel/replay";
import { confidenceBandLabel } from "@/lib/kernel/confidence";
import { ACTIVITY_KIND_LABEL } from "@/lib/kernel/observability";
import { downloadText, slugFile } from "@/lib/kernel/export";
import { buildKernelPacket } from "@/lib/kernel/packet";
import { serializePacket } from "@/lib/kernel/packet-export";
import { rememberPacket } from "@/lib/kernel/attestation";
import { useKernel } from "@/lib/kernel/store";
import { startCase } from "@/lib/research/run-investigation";
import { interpretationLabel } from "@/lib/ai/observe";
import { formatWhen } from "@/lib/utils";
import { interpretationVoice } from "@/lib/ui/finding-voice";

export function DossierSheet({
  dossier,
  goal,
  findings,
  evidence,
  memory,
}: {
  dossier: Dossier;
  goal: Goal;
  findings: Finding[];
  evidence: Evidence[];
  memory: MemoryRecord[];
}) {
  const navigate = useNavigate();
  const goals = useKernel((s) => s.goals);
  const allFindings = useKernel((s) => s.findings);
  const allEvidence = useKernel((s) => s.evidence);
  const contradictions = useKernel((s) => s.contradictions);
  const memoryDecisions = useKernel((s) => s.memoryDecisions);
  const dossiers = useKernel((s) => s.dossiers);
  const learning = useKernel((s) => s.learning);
  const learningDecisions = useKernel((s) => s.learningDecisions);
  const evaluations = useKernel((s) => s.confidence);
  const activity = useKernel((s) => s.activity);
  const [opening, setOpening] = useState(false);
  const spawned = spawnedFromDossier(goals, dossier.id);
  const related = relatedMemory(goal.text, memory, allFindings, goal.id);
  const influence = memoryInfluence(dossier, related, memory);
  const listed = contradictionsTouching(contradictions, {
    sealId: dossier.id,
    goalId: dossier.goalId,
  }).filter(
    (item) =>
      item.sealId === dossier.id ||
      item.left.id === dossier.id ||
      item.right.id === dossier.id ||
      (item.kind !== "interpretation-interpretation" && item.goalId === dossier.goalId),
  );
  const replay = useMemo(
    () =>
      replaySeal(
        {
          goals,
          evidence: allEvidence,
          findings: allFindings,
          memory,
          memoryDecisions,
          dossiers,
          contradictions,
          learning,
          learningDecisions,
          confidence: evaluations,
          activity,
        },
        dossier.id,
      ),
    [goals, allEvidence, allFindings, memory, memoryDecisions, dossiers, contradictions, learning, learningDecisions, evaluations, activity, dossier.id],
  );
  const thenInterpreter = replay.activity.find(
    (item) =>
      (item.kind === "ai.completed" || item.kind === "ai.failed") &&
      item.ai?.operation === "interpret" &&
      item.ai,
  );

  function exportDossier() {
    downloadText(
      `${slugFile(goal.text)}-dosier.md`,
      dossierToMarkdown(dossier, goal, findings, evidence, memory),
      "text/markdown;charset=utf-8",
    );
  }

  async function exportPacket() {
    const packet = await buildKernelPacket({
      goal,
      evidence,
      findings,
      dossier,
      contradictions,
    });
    rememberPacket(packet);
    const file = serializePacket(packet, "envelope");
    downloadText(file.filename, file.text, file.mime);
  }

  return (
    <article className="dossier">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <SealMark hash={dossier.sealHash} />
          <div className="min-w-0">
            <p className="kicker">Dosier sellado</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-subtle break-all">
              {dossier.sealHash}
            </p>
            <p className="mt-1 text-xs text-subtle">{formatWhen(dossier.sealedAt)}</p>
            {dossier.memoryContextHash ? (
              <p className="mt-1 break-all font-mono text-[11px] text-subtle">
                contexto {dossier.memoryContextHash}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportDossier}>
            <IconExport className="size-3.5" />
            Exportar dosier
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportPacket()}>
            <IconExport className="size-3.5" />
            Paquete para agentes
          </Button>
        </div>
      </header>

      <section className="mt-8">
        <p className="kicker">00 · Síntesis</p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg/90">
          {interpretationVoice(dossier.executive)}
        </p>
      </section>

      <section className="mt-8">
        <p className="kicker">01 · Ya se sabía</p>
        {dossier.known.length ? (
          <ul className="mt-3 space-y-2">
            {dossier.known.map((item) => {
              const alive = memory.some((row) => row.id === item.memoryId && isAdmittedMemory(row));
              const destGoalId = item.goalId || memory.find((row) => row.id === item.memoryId)?.goalId;
              return (
                <li key={item.memoryId} className="text-sm text-muted">
                  {alive && destGoalId ? (
                    <Link
                      to="/goals/$goalId"
                      params={{ goalId: destGoalId }}
                      className="text-accent"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <>
                      {item.title}
                      <span className="mt-1 block text-xs text-subtle">
                        Memoria histórica. Ya no está vigente.
                      </span>
                    </>
                  )}
                </li>
              );
            })}

          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Nada. Este es el primer caso relacionado en el núcleo.
          </p>
        )}
      </section>

      <section className="mt-8">
        <p className="kicker">Reconstrucción</p>
        <p className="mt-2 text-sm text-muted">
          Lo que el Kernel vio y utilizó al sellar. No relee fuentes ni sustituye esta
          memoria por la que está vigente ahora.
        </p>
        {thenInterpreter?.ai ? (
          <p className="mt-3 text-sm text-muted">
            {thenInterpreter.kind === "ai.completed"
              ? `Entonces interpretó ${interpretationLabel(thenInterpreter.ai)}. El Kernel admitió.`
              : `Entonces ${interpretationLabel(thenInterpreter.ai)} no interpretó. La evidencia retenida sigue en el sello.`}
          </p>
        ) : null}
        {replay.status === "incomplete" ? (
          <div className="mt-3 space-y-1">
            <p className="text-sm text-ember">{HISTORIAL_INSUFICIENTE}</p>
            {replay.missing.map((gap) => (
              <p key={`${gap.field}:${gap.id ?? ""}`} className="text-xs text-subtle">
                {gap.why}
              </p>
            ))}
            {replay.reconstructed.length ? (
              <p className="text-xs text-subtle">
                Sí se reconstruyó: {replay.reconstructed.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
        {replay.memory.length ? (
          <ul className="mt-3 space-y-2">
            {replay.memory.map((item) => (
              <li key={item.memoryId} className="text-sm text-muted">
                Memoria utilizada: {item.title}
                <span className="mt-1 flex items-center gap-2 text-xs text-subtle">
                  En el sello
                  <StatusChip kind={item.lifecycleAtConsult} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Este sello no consultó memoria.</p>
        )}
        {replay.decisions.length ? (
          <ol className="mt-3 space-y-1">
            {replay.decisions.map((row) => (
              <li key={row.id} className="text-xs text-subtle">
                {row.from ?? "origen"} → {row.to} · {row.why}
              </li>
            ))}
          </ol>
        ) : null}
        {replay.contradictions.length ? (
          <ul className="mt-3 space-y-2">
            {replay.contradictions.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                <span className="block text-xs text-subtle">{contradictionLabel(item.kind)}</span>
                <span className="mt-1 block">{item.note}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {replay.lineage.length > 1 ? (
          <ol className="mt-3 space-y-1">
            {replay.lineage.map((item, index) => (
              <li key={item.sealId} className="text-xs text-subtle">
                {index + 1}. {item.sealId === dossier.id ? "Este sello" : "Sello"}
                {item.causeFromPrevious ? ` · ${item.changeNote}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
        {replay.learning.candidates.length ? (
          <ul className="mt-3 space-y-2">
            {replay.learning.candidates.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                Aprendizaje entonces: {item.title}
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                  <StatusChip kind={item.status} />
                  {item.origin.note}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {replay.confidence.length ? (
          <ul className="mt-3 space-y-2">
            {replay.confidence.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                Confianza entonces: {item.score} · {confidenceBandLabel(item.band)}
                <span className="mt-1 block text-xs text-subtle">
                  {item.algorithm} · política {item.policyId} v{item.policyVersion}
                </span>
                {item.reasons
                  .filter((row) => row.delta < 0)
                  .map((row, index) => (
                    <span key={`${row.kind}-${index}`} className="mt-1 block text-xs text-ember">
                      {row.note}
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        ) : null}
        {replay.activity.length ? (
          <ul className="mt-3 space-y-2">
            {replay.activity.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                Entonces: {ACTIVITY_KIND_LABEL[item.kind]} · {item.summary}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {influence.notConsulted.length ? (
        <section className="mt-8">
          <p className="kicker">Memoria que no influyó</p>
          <p className="mt-2 text-sm text-muted">
            Estaba admitida y era cercana. Este sello no la consultó. No es evidencia.
          </p>
          <ul className="mt-3 space-y-2">
            {influence.notConsulted.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listed.length ? (
        <section className="mt-8">
          <p className="kicker">Contradicción</p>
          <ul className="mt-3 space-y-2">
            {listed.map((item) => (
              <li key={item.id} className="text-sm text-muted">
                <span className="block text-xs text-subtle">{contradictionLabel(item.kind)}</span>
                <span className="mt-1 block">{item.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dossier.memoryConsulted > 0 ? (
        <section className="mt-8 grid gap-6 sm:grid-cols-3">
          <DeltaColumn n="02" label="Nuevo" items={dossier.novel} empty="Sin material nuevo frente a memoria." />
          <DeltaColumn n="03" label="Confirmado" items={dossier.confirmed} empty="Nada confirmó memoria previa." />
          <TensionColumn
            findings={findings.filter(
              (item) => dossier.findingIds.includes(item.id) && item.delta === "tension",
            )}
            memory={memory}
            empty="Sin conflicto con memoria admitida."
          />
        </section>
      ) : null}

      {dossier.uncertain.length ? (
        <section className="mt-8">
          <p className="kicker">05 · Incierto</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {dossier.uncertain.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {dossier.next ? (
        <section className="mt-8">
          <p className="kicker">06 · Siguiente</p>
          <p className="mt-3 text-sm text-fg/85">{dossier.next}</p>
          {spawned ? (
            <Link
              to="/goals/$goalId"
              params={{ goalId: spawned.id }}
              className="mt-3 inline-flex min-h-11 items-center text-sm text-accent"
            >
              Caso abierto
            </Link>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={opening}
              onClick={() => {
                setOpening(true);
                void startCase(
                  dossier.next,
                  {
                    goalId: dossier.goalId,
                    dossierId: dossier.id,
                  },
                  (opened) => {
                    void navigate({
                      to: "/goals/$goalId",
                      params: { goalId: opened.id },
                    });
                  },
                ).finally(() => setOpening(false));
              }}
            >
              {opening ? "Forjando…" : "Forjar esto"}
            </Button>
          )}
        </section>
      ) : null}

      <section className="mt-8">
        <p className="kicker">07 · Procedencia</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 text-muted">
            <dt>Fuentes</dt>
            <dd className="tabular-nums text-fg">{dossier.sourceHosts.length}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Huellas</dt>
            <dd className="tabular-nums text-fg">{dossier.evidenceHashes.length}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Reutilizadas</dt>
            <dd className="tabular-nums text-fg">{dossier.reusedCount}</dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Memoria consultada</dt>
            <dd className="tabular-nums text-fg">{dossier.memoryConsulted}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-2">
          {dossier.sourceHosts.map((host) => (
            <li key={host} className="font-mono text-xs text-subtle">
              {host}
            </li>
          ))}
        </ul>
        <Link
          to="/goals/$goalId"
          params={{ goalId: goal.id }}
          hash="evidencia"
          className="mt-4 inline-flex min-h-11 items-center text-sm text-accent"
        >
          Inspeccionar evidencia
        </Link>
      </section>
    </article>
  );
}

function TensionColumn({
  findings,
  memory,
  empty,
}: {
  findings: Finding[];
  memory: MemoryRecord[];
  empty: string;
}) {
  return (
    <div>
      <p className="kicker">04 · Tensión</p>
      {findings.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {findings.map((finding) => {
            const record = finding.deltaMemoryId
              ? memory.find((item) => item.id === finding.deltaMemoryId)
              : undefined;
            return (
              <li key={finding.id}>
                <span>{finding.title}</span>
                {record ? (
                  <Link
                    to="/goals/$goalId"
                    params={{ goalId: record.goalId }}
                    className="mt-1 block text-xs text-subtle"
                  >
                    Memoria: {record.title}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">{empty}</p>
      )}
    </div>
  );
}

function DeltaColumn({
  n,
  label,
  items,
  empty,
}: {
  n: string;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="kicker">
        {n} · {label}
      </p>
      {items.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">{empty}</p>
      )}
    </div>
  );
}
