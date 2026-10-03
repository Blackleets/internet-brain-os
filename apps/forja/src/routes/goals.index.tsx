import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { IconSight, IconWatch } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import { formatWhen } from "@/lib/utils";

export const Route = createFileRoute("/goals/")({ component: GoalsPage });

function GoalsPage() {
  const goals = useKernel((s) => s.goals);
  return (
    <div>
      <PageHeader
        title="Objetivos"
        description="Cada objetivo es una investigación acotada. El progreso solo avanza con hechos observados."
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={<IconSight className="size-5" />}
          title="Sin objetivos"
          body="Un objetivo no es un prompt. Es un caso: búsqueda pública, lectura, evidencia, interpretación."
          action={
            <Link to="/" className="inline-flex min-h-11 items-center text-sm text-accent">
              Abrir la forja
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link
                to="/goals/$goalId"
                params={{ goalId: goal.id }}
                className="block rounded-xl bg-surface p-5 shadow-border"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
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
                  {goal.watched ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ember">
                      <IconWatch className="size-3.5" />
                      Vigilado
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed">{goal.text}</p>
                <p className="mt-2 text-xs text-subtle">
                  {formatWhen(goal.createdAt)} · {goal.evidenceIds.length} evidencia ·{" "}
                  {(goal.leads ?? []).length} pistas · {goal.findingIds.length} hallazgos
                  {goal.lastWatchSummary ? ` · ${goal.lastWatchSummary}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
