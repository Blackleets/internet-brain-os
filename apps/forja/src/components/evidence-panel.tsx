import { Link } from "@tanstack/react-router";
import { StatusChip } from "./status-chip";
import { Panel } from "./panel";
import { SourceMark } from "./source-mark";
import { IconCheck, IconExternal } from "./icons";
import type { Evidence } from "@/lib/kernel/types";
import { useKernel } from "@/lib/kernel/store";
import { normalizeUrl } from "@/lib/kernel/watch";
import { formatBytes, formatWhen } from "@/lib/utils";

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const all = useKernel((s) => s.evidence);
  const goals = useKernel((s) => s.goals);
  const watchPasses = useKernel((s) => s.watchPasses);
  const siblings = all.filter(
    (item) =>
      item.goalId === evidence.goalId && normalizeUrl(item.url) === normalizeUrl(evidence.url),
  );
  const newest = siblings.reduce(
    (best, item) => (item.retrievedAt > best.retrievedAt ? item : best),
    evidence,
  );
  const isPrior = siblings.length > 1 && newest.id !== evidence.id;
  const isCurrent = siblings.length > 1 && newest.id === evidence.id;
  const goal = goals.find((item) => item.id === evidence.goalId);
  const reread = watchPasses.find((pass) =>
    pass.observations.some(
      (item) => item.newEvidenceId === evidence.id || item.previousEvidenceId === evidence.id,
    ),
  );
  const bornFromWatch = reread?.observations.some((item) => item.newEvidenceId === evidence.id);
  const observedElsewhere = all.find(
    (item) =>
      item.goalId !== evidence.goalId && item.contentHash === evidence.contentHash,
  );
  const otherGoal = observedElsewhere
    ? goals.find((item) => item.id === observedElsewhere.goalId)
    : undefined;

  const gates = [
    "Fuente recuperada",
    `HTTP ${evidence.httpStatus} observado`,
    "Evidencia retenida por el Kernel",
    `Huella ${evidence.contentHash.slice(0, 12)}…`,
  ];
  return (
    <Panel hover className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SourceMark host={evidence.sourceHost} />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatusChip kind={evidence.validation} />
            {evidence.reused ? <StatusChip kind="reused" /> : null}
            {isCurrent ? <StatusChip kind="vigente" /> : null}
            {isPrior ? <StatusChip kind="prior" /> : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-subtle">{evidence.id}</p>
        </div>
      </div>
      <h3 className="font-display text-xl leading-snug">{evidence.title}</h3>
      <p className="mt-1 text-sm text-muted">{evidence.sourceHost}</p>
      {goal ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: goal.id }}
          className="mt-1 inline-block text-xs text-subtle"
        >
          Caso: {goal.text}
        </Link>
      ) : null}
      {bornFromWatch && reread ? (
        <p className="mt-1 text-xs text-subtle">Tras relectura {formatWhen(reread.at)}</p>
      ) : null}
      {otherGoal ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: otherGoal.id }}
          className="mt-1 inline-block text-xs text-subtle"
        >
          Ya observada en: {otherGoal.text}
        </Link>
      ) : null}
      <ul className="mt-4 space-y-1.5 text-sm text-muted">
        {gates.map((gate) => (
          <li key={gate} className="flex items-center gap-2">
            <IconCheck className="size-3.5 text-verified" />
            {gate}
          </li>
        ))}
        <li className="pl-6 text-xs text-subtle">
          {formatWhen(evidence.retrievedAt)} · {formatBytes(evidence.bytes)}
        </li>
      </ul>
      <p className="mt-4 line-clamp-6 text-sm leading-relaxed text-fg/85">
        {evidence.excerpt}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/evidence/$evidenceId"
          params={{ evidenceId: evidence.id }}
          className="inline-flex min-h-11 items-center text-sm text-accent"
        >
          Inspeccionar
        </Link>
        <a
          href={evidence.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted"
        >
          Abrir fuente
          <IconExternal className="size-3.5" />
        </a>
      </div>
    </Panel>
  );
}
