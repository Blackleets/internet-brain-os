import { citedObservations } from "@/lib/ui/forge-receipt";
import { splitLabeledAnswer } from "@/lib/ui/finding-voice";
import { findingIsUnverifiedLead } from "@/lib/ui/case-view";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusChip } from "./status-chip";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Panel } from "./panel";
import { IconChevron, IconExport, IconPin } from "./icons";
import type { Finding } from "@/lib/kernel/types";
import { useKernel } from "@/lib/kernel/store";
import { tensedMemory } from "@/lib/kernel/delta";
import { isAdmittedMemory } from "@/lib/kernel/authority";
import { downloadText, findingToMarkdown, slugFile } from "@/lib/kernel/export";
import { confidenceBandLabel, latestConfidence, openSupportConflicts } from "@/lib/kernel/confidence";
import { interpretationLabel, interpretationForFinding } from "@/lib/ai/observe";

export function FindingCard({
  finding,
  showGoal = false,
}: {
  finding: Finding;
  showGoal?: boolean;
}) {
  const evidenceCount = finding.evidenceIds.length;
  const unverifiedLead = findingIsUnverifiedLead(finding);
  const memory = useKernel((s) => s.memory);
  const evidence = useKernel((s) => s.evidence);
  const goals = useKernel((s) => s.goals);
  const evaluations = useKernel((s) => s.confidence);
  const activity = useKernel((s) => s.activity);
  const support = latestConfidence(evaluations, finding.id);
  const interpretation = interpretationForFinding(activity, finding);
  const relatedRecord = finding.deltaMemoryId
    ? memory.find((item) => item.id === finding.deltaMemoryId)
    : undefined;
  const tensed = tensedMemory(finding, memory);
  const cited = citedObservations(finding, evidence);
  const voice = splitLabeledAnswer(finding.answer);
  const uncertainties = [...finding.uncertainties, ...voice.extraUncertainties.filter((item) => !finding.uncertainties.includes(item))];
  const remembered = memory.some((item) => item.findingId === finding.id && isAdmittedMemory(item));
  const goal = goals.find((item) => item.id === finding.goalId);
  const [why, setWhy] = useState("");
  const [admitError, setAdmitError] = useState<string | null>(null);
  const canAdmit = why.trim().length >= 8;

  function exportFinding() {
    downloadText(
      `${slugFile(finding.title)}.md`,
      findingToMarkdown(finding, evidence, goal),
      "text/markdown;charset=utf-8",
    );
  }

  function admit() {
    const result = useKernel.getState().admitFindingToMemory(finding.id, why);
    if (!result.ok) {
      setAdmitError(result.reason);
      return;
    }
    setAdmitError(null);
    setWhy("");
  }

  function replace() {
    const result = useKernel.getState().replaceTensedMemory(finding.id, why);
    if (!result.ok) {
      setAdmitError(result.reason);
      return;
    }
    setAdmitError(null);
    setWhy("");
  }

  return (
    <Panel className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {unverifiedLead ? (
          <StatusChip kind="unverified" />
        ) : (
          <>
            <StatusChip kind={finding.confidence} />
            <StatusChip kind="interpretation" />
          </>
        )}
        {finding.delta ? <StatusChip kind={finding.delta} /> : null}
      </div>
      {unverifiedLead ? (
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ember">
          Lead no verificado · falta evidencia o interpretación admitida
        </p>
      ) : interpretation?.ok ? (
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-subtle">
          Interpretó {interpretationLabel(interpretation.ai)} · el Kernel admitió
        </p>
      ) : null}
      <h3 className="font-display text-2xl tracking-tight">{finding.title}</h3>
      {showGoal && goal ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: goal.id }}
          className="mt-1 inline-block text-xs text-subtle"
        >
          Caso: {goal.text}
        </Link>
      ) : null}

      <div className="mt-4 space-y-3">
        <section>
          <p className="kicker">Observado</p>
          {cited.length ? (
            <ul className="mt-2 space-y-2">
              {cited.map((item) => (
                <li key={item.id} className="text-sm leading-relaxed text-muted">
                  <span className="text-subtle">{item.sourceHost}: </span>
                  {item.excerpt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-subtle">Sin extracto retenido. El Kernel no inventa observación.</p>
          )}
        </section>
        <section>
          <p className="kicker">Interpretado</p>
          <p className="mt-2 text-sm leading-relaxed text-fg/90">{voice.interpretation}</p>
          <p className="mt-1 text-xs text-subtle">
            Lectura admitida por el Kernel sobre evidencia. No es un dato observado ni una predicción.
          </p>
        </section>
        {uncertainties.length ? (
          <section>
            <p className="kicker">Incierto</p>
            <p className="mt-2 text-sm text-muted">{uncertainties.join(" · ")}</p>
          </section>
        ) : null}
      </div>
      {finding.deltaNote ? (
        <p className="mt-3 text-sm text-muted">{finding.deltaNote}</p>
      ) : null}
      {relatedRecord && relatedRecord.goalId !== finding.goalId ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: relatedRecord.goalId }}
          className="mt-2 inline-flex min-h-10 items-center text-sm text-accent"
        >
          Memoria: {relatedRecord.title}
        </Link>
      ) : null}
      {tensed && !remembered ? (
        <p className="mt-2 text-sm text-muted">
          Admitir conserva ambas. Sustituir olvida esa memoria — con tu razón.
        </p>
      ) : null}
      {tensed && remembered ? (
        <p className="mt-2 text-sm text-muted">
          Ambas están en memoria. La tensión sigue abierta hasta que olvides una.
        </p>
      ) : null}
      {finding.delta === "tension" && !tensed ? (
        <p className="mt-2 text-sm text-muted">
          Esta lectura tensionaba una memoria que ya no está en el Kernel.
        </p>
      ) : null}

      {support ? (
        <div className="mt-4 rounded-md bg-bg-elevated p-4">
          <p className="kicker">Soporte del Kernel</p>
          <p className="mt-2 text-sm text-muted">
            {support.score} · {confidenceBandLabel(support.band)}. No es una medida de verdad.
          </p>
          <ul className="mt-2 space-y-1">
            {support.reasons
              .filter((item) => item.delta !== 0 || item.kind === "freshness" || openSupportConflicts(support).includes(item))
              .slice(0, 6)
              .map((item, index) => (
                <li key={`${item.kind}-${index}`} className={item.delta < 0 ? "text-sm text-ember" : "text-xs text-subtle"}>
                  {item.note}
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">
            {support.algorithm} · política {support.policyId}
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-md bg-bg-elevated p-4">
        <p className="kicker">Por qué importa</p>
        <p className="mt-2 text-sm text-muted">{finding.whyItMatters}</p>
      </div>
      {finding.nextAction ? (
        <p className="mt-3 text-sm text-fg/80">Siguiente: {finding.nextAction}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/findings/$findingId"
          params={{ findingId: finding.id }}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-accent"
        >
          Ver procedencia
          <IconChevron className="size-4" />
          <span className="text-muted">
            {evidenceCount} {evidenceCount === 1 ? "evidencia" : "evidencias"}
          </span>
        </Link>
        <Button variant="ghost" size="sm" onClick={exportFinding}>
          <IconExport className="size-3.5" />
          Exportar
        </Button>
      </div>
      {remembered ? (
        <p className="mt-3 text-sm text-verified">En memoria</p>
      ) : (
        <form
          className="mt-4 space-y-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canAdmit) return;
            admit();
          }}
        >
          <label className="block">
            <span className="kicker">¿Por qué lo retenemos?</span>
            <Input
              className="mt-2 min-h-11 text-sm"
              value={why}
              onChange={(event) => {
                setWhy(event.target.value);
                setAdmitError(null);
              }}
              placeholder="Una frase tuya. El modelo no basta."
              maxLength={280}
            />
          </label>
          {admitError ? <p className="text-xs text-danger">{admitError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={!canAdmit}>
              <IconPin className="size-3.5" />
              Admitir
            </Button>
            {tensed ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canAdmit}
                onClick={replace}
              >
                Sustituir memoria
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </Panel>
  );
}
