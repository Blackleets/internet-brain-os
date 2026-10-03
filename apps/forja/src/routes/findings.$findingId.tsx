import { createFileRoute, Link } from "@tanstack/react-router";
import { EvidencePanel } from "@/components/evidence-panel";
import { FindingCard } from "@/components/finding-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useKernel } from "@/lib/kernel/store";
import { traceFinding } from "@/lib/kernel/provenance";
import { contradictionLabel, contradictionsTouching } from "@/lib/kernel/contradiction";
import { confidenceBandLabel, confidenceHistory } from "@/lib/kernel/confidence";

export const Route = createFileRoute("/findings/$findingId")({
  component: FindingDetail,
});

function FindingDetail() {
  const { findingId } = Route.useParams();
  const findings = useKernel((s) => s.findings);
  const allEvidence = useKernel((s) => s.evidence);
  const goals = useKernel((s) => s.goals);
  const dossiers = useKernel((s) => s.dossiers);
  const memory = useKernel((s) => s.memory);
  const contradictions = useKernel((s) => s.contradictions);
  const evaluations = useKernel((s) => s.confidence);
  const finding = findings.find((item) => item.id === findingId);
  const evidence = finding
    ? allEvidence.filter((item) => finding.evidenceIds.includes(item.id))
    : [];
  const goal = finding ? goals.find((item) => item.id === finding.goalId) : undefined;
  const trace = finding ? traceFinding(finding, allEvidence, dossiers) : null;
  const influenced = trace?.influencedByMemoryId
    ? memory.find((item) => item.id === trace.influencedByMemoryId)
    : undefined;
  const closing = trace?.closedBySealId
    ? dossiers.find((item) => item.id === trace.closedBySealId)
    : undefined;
  const history = finding ? confidenceHistory(evaluations, finding.id) : [];
  const listed = finding
    ? contradictionsTouching(contradictions, { findingId: finding.id, evidenceId: finding.evidenceIds[0] })
    : [];

  if (!finding) {
    return <p className="text-sm text-muted">Hallazgo no encontrado.</p>;
  }

  return (
    <div className="space-y-8">
      {goal ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: goal.id }}
          className="text-sm text-muted"
        >
          Objetivo: {goal.text}
        </Link>
      ) : null}
      <PageHeader title={finding.title} />
      <FindingCard finding={finding} />
      {trace ? (
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Procedencia</h2>
          <p className="mt-2 text-sm text-muted">
            El Kernel admite. Esta cadena sale del estado, no de una explicación del modelo.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>
              Fuentes: {trace.sourceHosts.join(", ") || "ninguna"}
            </li>
            {influenced ? (
              <li>
                Memoria que influyó en la lectura: {influenced.title}. No es evidencia de
                este hallazgo.
              </li>
            ) : (
              <li>Ninguna memoria admitida figura como influencia de este hallazgo.</li>
            )}
            {closing && goal ? (
              <li>
                Lo cerró el sello{" "}
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: goal.id }}
                  className="break-all font-mono text-[11px] text-accent"
                >
                  {closing.sealHash}
                </Link>
              </li>
            ) : (
              <li>Ningún sello de este caso incluye aún este hallazgo.</li>
            )}
            {listed.map((item) => (
              <li key={item.id}>
                {contradictionLabel(item.kind)}: {item.note}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {history.length ? (
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Soporte en el tiempo</h2>
          <p className="mt-2 text-sm text-muted">
            Cada evaluación es una versión. El Kernel no sobrescribe la anterior.
          </p>
          <ol className="mt-4 space-y-3">
            {history.map((item) => (
              <li key={item.id}>
                <p className="text-sm text-muted">
                  V{item.version} · {item.score} · {confidenceBandLabel(item.band)}
                </p>
                {item.changeNote ? (
                  <p className="mt-1 text-xs text-subtle">{item.changeNote}</p>
                ) : (
                  <p className="mt-1 text-xs text-subtle">
                    {item.algorithm} · política {item.policyId}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      <section>
        <h2 className="mb-4 font-display text-2xl">Evidencia vinculada</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {evidence.map((item) => (
            <EvidencePanel key={item.id} evidence={item} />
          ))}
        </div>
      </section>
    </div>
  );
}