import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusChip } from "@/components/status-chip";
import { SourceMark } from "@/components/source-mark";
import { Panel } from "@/components/panel";
import { IconExternal } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import { formatBytes, formatWhen } from "@/lib/utils";

export const Route = createFileRoute("/evidence/$evidenceId")({
  component: EvidenceDetail,
});

function EvidenceDetail() {
  const { evidenceId } = Route.useParams();
  const evidence = useKernel((s) => s.evidence);
  const goals = useKernel((s) => s.goals);
  const watchPasses = useKernel((s) => s.watchPasses);
  const item = evidence.find((row) => row.id === evidenceId);
  if (!item) return <p className="text-sm text-muted">Evidencia no encontrada.</p>;
  const goal = goals.find((row) => row.id === item.goalId);
  const reread = watchPasses.find((pass) =>
    pass.observations.some(
      (row) => row.newEvidenceId === item.id || row.previousEvidenceId === item.id,
    ),
  );

  return (
    <article className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SourceMark host={item.sourceHost} className="size-10" />
        <StatusChip kind={item.validation} />
        <span className="font-mono text-xs text-subtle">{item.id}</span>
      </div>
      {goal ? (
        <Link
          to="/goals/$goalId"
          params={{ goalId: goal.id }}
          className="mb-3 inline-block text-sm text-muted"
        >
          Caso: {goal.text}
        </Link>
      ) : null}
      <h1 className="font-display text-4xl tracking-tight">{item.title}</h1>
      <p className="mt-2 text-sm text-muted">{item.sourceHost}</p>
      {reread ? (
        <p className="mt-2 text-xs text-subtle">Vista en relectura {formatWhen(reread.at)}</p>
      ) : null}
      <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-subtle">Recuperada</dt>
          <dd>{formatWhen(item.retrievedAt)}</dd>
        </div>
        <div>
          <dt className="text-subtle">HTTP</dt>
          <dd className="tabular-nums">{item.httpStatus}</dd>
        </div>
        <div className="min-w-0 md:col-span-2">
          <dt className="text-subtle">Huella SHA-256</dt>
          <dd className="break-all font-mono text-xs">{item.contentHash}</dd>
        </div>
        <div>
          <dt className="text-subtle">Tamaño observado</dt>
          <dd className="tabular-nums">{formatBytes(item.bytes)}</dd>
        </div>
      </dl>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex min-h-11 max-w-full items-center gap-2 text-sm text-accent"
      >
        <span className="min-w-0 break-all">{item.url}</span>
        <IconExternal className="size-4 shrink-0" />
      </a>
      <Panel className="mt-8 p-5">
        <h2 className="kicker">Extracto retenido</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg/90">
          {item.excerpt}
        </p>
      </Panel>
    </article>
  );
}
